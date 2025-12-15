#!/bin/bash
source venv/bin/activate
# Run on port 8000, reload on change for easier dev
uvicorn main:app --reload --port 8000
