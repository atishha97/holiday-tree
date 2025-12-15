const { createApp, ref, onMounted, computed } = Vue

createApp({
    setup() {
        // State
        const loading = ref(false)
        const treeId = ref(null)
        const treeOwnerId = ref(null) // New ref for owner check
        const ornaments = ref([])
        const user = ref(null)

        // Drag and Drop State
        const pendingOrnament = ref(null) // { type, x, y }
        const selectedOrnament = ref(null)
        const dropZone = ref(null)

        const newOrnament = ref({
            sender: '',
            message: ''
        })

        // Assets
        const availableOrnaments = [
            'Ornament1.png', 'Ornament2.png', 'Ornament3.png', 'Ornament4.png',
            'Ornament5.png', 'Ornament6.png', 'Ornanent7.png', 'Ornament8.png'
        ]

        // --- Data Logic (Firestore) ---

        // Real-time listener for ornaments
        const subscribeToOrnaments = (tid) => {
            if (!tid || !window.db) return
            window.db.collection('ornaments')
                .where('tree_id', '==', tid)
                // .orderBy('created_at', 'asc') // Removing server-side sort to avoid Index issues
                .onSnapshot((snapshot) => {
                    const loaded = []
                    snapshot.forEach((doc) => {
                        loaded.push({ id: doc.id, ...doc.data() })
                    })
                    // Client-side sort
                    loaded.sort((a, b) => {
                        if (!a.created_at || !b.created_at) return 0
                        return a.created_at.seconds - b.created_at.seconds
                    })
                    ornaments.value = loaded
                }, (error) => {
                    console.error("Snapshot error:", error)
                    // If it's an index error, this will show in console, but client-side sort fixes it.
                })
        }

        const createTree = async () => {
            loading.value = true
            // Failsafe timeout
            const timeout = setTimeout(() => {
                if (loading.value) {
                    loading.value = false
                    alert("Request timed out. Please check your connection.")
                }
            }, 10000)

            try {
                if (!window.db) throw new Error("Firebase not initialized")

                // Prepare tree data
                const treeData = {
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                }

                // If user is signed in, assign ownership
                if (user.value) {
                    treeData.owner_id = user.value.uid
                    treeData.owner_name = user.value.displayName
                }

                // Create a tree doc in Firestore
                const docRef = await window.db.collection('trees').add(treeData)
                treeId.value = docRef.id
                treeOwnerId.value = treeData.owner_id || null // Store owner

                // Update URL

                // Update URL
                window.history.pushState({}, '', `/tree/${treeId.value}`)

                // Start listening
                subscribeToOrnaments(treeId.value)
            } catch (error) {
                console.error("Error creating tree:", error)
                alert("Failed to create tree. Check console.")
            } finally {
                clearTimeout(timeout)
                loading.value = false
            }
        }

        const loadTree = async () => {
            if (!treeId.value) return
            loading.value = true
            // Failsafe timeout
            const timeout = setTimeout(() => {
                if (loading.value) {
                    loading.value = false
                    alert("Request timed out. Please check your connection.")
                }
            }, 10000)

            try {
                if (!window.db) throw new Error("Firebase not initialized")
                const docSnap = await window.db.collection('trees').doc(treeId.value).get()
                if (docSnap.exists) {
                    treeOwnerId.value = docSnap.data().owner_id || null // Store owner
                    subscribeToOrnaments(treeId.value)
                } else {
                    console.warn("Tree not found in Firestore, creating new one.")
                    // Fallback: Create new tree if ID invalid
                    treeId.value = null
                    window.history.pushState({}, '', '/')
                    createTree()
                }
            } catch (e) {
                console.error("Error loading tree:", e)
            } finally {
                clearTimeout(timeout)
                loading.value = false
            }
        }

        // --- Drag & Drop Logic ---

        const startDrag = (evt, ornamentType, existingId = null) => {
            evt.dataTransfer.dropEffect = 'copy'
            evt.dataTransfer.effectAllowed = 'copy'
            evt.dataTransfer.setData('ornamentType', ornamentType)
            if (existingId) {
                evt.dataTransfer.setData('ornamentId', existingId)
            }
        }

        const onDrop = async (evt) => {
            if (!treeId.value) {
                console.warn("Tree not loaded yet")
                return
            }

            // Check for Move vs New
            const existingId = evt.dataTransfer.getData('ornamentId')
            const ornamentType = evt.dataTransfer.getData('ornamentType')

            if (!ornamentType) return
            if (!dropZone.value) return

            const rect = dropZone.value.getBoundingClientRect()
            const x = ((evt.clientX - rect.left) / rect.width) * 100
            const y = ((evt.clientY - rect.top) / rect.height) * 100

            // Case A: Moving Existing Ornament
            if (existingId) {
                // Determine if user is owner before allowing write? Rules will enforce, but UI check good too.
                if (!isOwner.value) return

                try {
                    await window.db.collection('ornaments').doc(existingId).update({
                        x: x,
                        y: y
                    })
                } catch (e) {
                    console.error("Move failed", e)
                }
                return
            }

            // Case B: New Ornament
            pendingOrnament.value = {
                type: ornamentType,
                x: x,
                y: y
            }

            // Reset modal inputs
            newOrnament.value.message = ''
            newOrnament.value.sender = '' // Explicitly clear sender
        }

        const cancelDrop = () => {
            pendingOrnament.value = null
            newOrnament.value = { sender: '', message: '' }
        }

        const confirmDrop = async () => {
            if (!pendingOrnament.value || !treeId.value || !newOrnament.value.sender) return

            loading.value = true
            try {
                if (!window.db) throw new Error("Firebase not initialized")

                const ornamentData = {
                    tree_id: treeId.value,
                    creator_id: user.value ? user.value.uid : null, // Record creator
                    sender: newOrnament.value.sender,
                    message: newOrnament.value.message,
                    ornament_type: pendingOrnament.value.type,
                    x: pendingOrnament.value.x,
                    y: pendingOrnament.value.y,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                }

                await window.db.collection('ornaments').add(ornamentData)
                cancelDrop()
            } catch (error) {
                console.error("Error adding ornament:", error)
                alert("Failed to save ornament. Check console.")
            } finally {
                loading.value = false
            }
        }

        const openMessage = (ornament) => {
            selectedOrnament.value = ornament
        }

        // --- Auth Logic ---
        const signIn = async () => {
            const provider = new firebase.auth.GoogleAuthProvider()
            try {
                await window.auth.signInWithPopup(provider)
            } catch (e) {
                console.error("Auth error", e)
                alert("Login failed: " + e.message)
            }
        }

        const signOut = async () => {
            try {
                await window.auth.signOut()
            } catch (e) {
                console.error("Sign out error", e)
            }
        }

        const copyLink = () => {
            const url = window.location.href
            navigator.clipboard.writeText(url).then(() => {
                alert("Tree link copied to clipboard!")
            }).catch(err => {
                alert("Failed to copy link.")
            })
        }

        // --- Init ---
        onMounted(async () => {
            if (!window.db || !window.auth) {
                console.error("Firebase globals missing!")
                // Don't alert immediately, give it a split second? No, script load order means it should be there.
            }

            // Auth Listener
            if (window.auth) {
                window.auth.onAuthStateChanged((u) => {
                    user.value = u
                })
            }

            // Routing
            const path = window.location.pathname
            const match = path.match(/\/tree\/(.+)/)
            if (match) {
                treeId.value = match[1]
                await loadTree()
            } else {
                await createTree()
            }
        })

        // Computed Permissions
        const isOwner = computed(() => {
            return user.value && treeOwnerId.value && user.value.uid === treeOwnerId.value
        })

        const canDelete = computed(() => {
            if (!selectedOrnament.value) return false
            // 1. Tree Owner can delete anything
            if (isOwner.value) return true
            // 2. Creator can delete their own
            if (user.value && selectedOrnament.value.creator_id === user.value.uid) return true
            return false
        })

        const deleteOrnament = async () => {
            if (!selectedOrnament.value) return
            if (!confirm("Are you sure you want to remove this ornament?")) return

            try {
                await window.db.collection('ornaments').doc(selectedOrnament.value.id).delete()
                selectedOrnament.value = null // Close modal
            } catch (e) {
                console.error("Delete failed", e)
                alert("Failed to delete.")
            }
        }

        return {
            loading,
            treeId,
            ornaments,
            availableOrnaments,
            pendingOrnament,
            newOrnament,
            selectedOrnament,
            dropZone,
            user,
            isOwner,
            canDelete, // Expose
            signIn,
            signOut,
            startDrag,
            onDrop,
            cancelDrop,
            confirmDrop,
            openMessage,
            deleteOrnament,
            copyLink
        }
    }
}).mount('#app')
