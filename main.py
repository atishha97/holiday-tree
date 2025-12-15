import sqlite3
import uuid
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Static files are mounted at the end to allow API routes to take precedence

# Allow CORS for development (though we serve static files from same origin mostly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup
DB_NAME = "holiday.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trees (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ornaments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tree_id TEXT,
                sender TEXT,
                message TEXT,
                ornament_type TEXT,
                x REAL,
                y REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(tree_id) REFERENCES trees(id)
            )
        """)
        conn.commit()

# Initialize DB on startup
init_db()

# Models
class TreeCreate(BaseModel):
    pass

class OrnamentCreate(BaseModel):
    sender: str
    message: str
    ornament_type: str
    x: float
    y: float

class OrnamentResponse(BaseModel):
    id: int
    tree_id: str
    sender: str
    message: str
    ornament_type: str
    x: float
    y: float
    created_at: str

# Routes
@app.post("/api/trees")
def create_tree():
    tree_id = str(uuid.uuid4())
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO trees (id) VALUES (?)", (tree_id,))
        conn.commit()
    return {"id": tree_id}

@app.get("/api/trees/{tree_id}")
def get_tree(tree_id: str):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trees WHERE id = ?", (tree_id,))
        tree = cursor.fetchone()
        if not tree:
            raise HTTPException(status_code=404, detail="Tree not found")
        
        # Get ornaments
        cursor.execute("SELECT id, tree_id, sender, message, ornament_type, x, y, created_at FROM ornaments WHERE tree_id = ?", (tree_id,))
        rows = cursor.fetchall()
        ornaments = [
            {
                "id": r[0],
                "tree_id": r[1],
                "sender": r[2],
                "message": r[3],
                "ornament_type": r[4],
                "x": r[5],
                "y": r[6],
                "created_at": r[7]
            }
            for r in rows
        ]
        
    return {"tree": {"id": tree[0], "created_at": tree[1]}, "ornaments": ornaments}

@app.post("/api/trees/{tree_id}/ornaments")
def add_ornament(tree_id: str, ornament: OrnamentCreate):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        # Verify tree exists
        cursor.execute("SELECT 1 FROM trees WHERE id = ?", (tree_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tree not found")
            
        cursor.execute("""
            INSERT INTO ornaments (tree_id, sender, message, ornament_type, x, y)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (tree_id, ornament.sender, ornament.message, ornament.ornament_type, ornament.x, ornament.y))
        conn.commit()
        
    return {"status": "success"}

# Serve index.html for root and other routes to support client-side routing if needed
from fastapi.responses import FileResponse

# Explicit route for /tree/{id} needed because it's a dynamic path not in static folder
@app.get("/tree/{tree_id}")
async def read_tree_app(tree_id: str):
    return FileResponse('static/index.html')

# Mount static files at root (catch-all)
# This serves index.html at / and app.js at /app.js
app.mount("/", StaticFiles(directory="static", html=True), name="static")
