// Firebase Configuration (Replace with your actual Firebase config)
const firebaseConfig = {
    apiKey: "AIzaSyCdVXY8feu2uiW_JVv0tOtN1MMKztCcrTU",
    authDomain: "dailytasktracker-817d5.firebaseapp.com",
    projectId: "dailytasktracker-817d5",
    storageBucket: "dailytasktracker-817d5.firebasestorage.app",
    messagingSenderId: "471139809864",
    appId: "1:471139809864:web:2d98f777906b94810cb67d"
};

// Firebase অ্যাপ শুরু করা
const app = firebase.initializeApp(firebaseConfig);
// Firestore ডাটাবেস ব্যবহার করার জন্য
const db = firebase.firestore();
// Firebase Auth ব্যবহার করার জন্য
const auth = firebase.auth();

// Global variables
let currentDate; // Stores the currently selected date (YYYY-MM-DD)
let tasksData = {}; // Stores tasks for the current date loaded from Firestore
let currentUserId = null; // Stores the current logged-in user's UID or null if not logged in
let currentContextMenu = null; // Global variable to track the currently open context menu

// New global variables for Task Details Modal
let currentTaskSection = null; // To store the section type of the opened task
let currentTaskIndex = null; // To store the index of the opened task

// DOM element references
const datePicker = document.getElementById('date-picker');
const savedDatesContainer = document.getElementById('saved-dates-container');
const loginLogoutBtn = document.getElementById('login-logout-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loginModalOverlay = document.getElementById('login-modal-overlay');
const mainContentWrapper = document.getElementById('main-content-wrapper');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginErrorMessage = document.getElementById('login-error-message');

// Success Modal elements
const successModalOverlay = document.getElementById('success-modal-overlay');
const successModalTitle = document.getElementById('success-modal-title');
const successModalMessage = document.getElementById('success-modal-message');
const closeSuccessModalBtn = document.getElementById('close-success-modal-btn');


// Task list elements for each section
const taskLists = {
    study: document.getElementById('study-list'),
    skill: document.getElementById('skill-list'),
    necessary: document.getElementById('necessary-list')
};

// Task input elements for each section
const taskInputs = {
    study: document.getElementById('study-input'),
    skill: document.getElementById('skill-input'),
    necessary: document.getElementById('necessary-input')
};

// Progress bar elements
const progressBars = {
    study: {
        fill: document.getElementById('study-progress-fill'),
        text: document.getElementById('study-progress-text')
    },
    skill: {
        fill: document.getElementById('skill-progress-fill'),
        text: document.getElementById('skill-progress-text')
    },
    necessary: {
        fill: document.getElementById('necessary-progress-fill'),
        text: document.getElementById('necessary-progress-text')
    }
};

// Reading Funnel Modal elements
const openReadingFunnelBtn = document.getElementById('open-reading-funnel-btn');
const readingFunnelModal = document.getElementById('reading-funnel-modal');
const closeReadingFunnelBtn = document.getElementById('close-reading-funnel-btn');

// Task Details Modal elements (UPDATED)
const taskDetailsModal = document.getElementById('task-details-modal');
const closeTaskDetailsBtn = document.getElementById('close-task-details-btn');
const taskPointsList = document.getElementById('task-points-list'); // NEW
const newTaskPointInput = document.getElementById('new-task-point-input'); // NEW
const addTaskPointBtn = document.getElementById('add-task-point-btn'); // NEW
const saveTaskDetailsBtn = document.getElementById('save-task-details-btn');
const cancelTaskDetailsBtn = document.getElementById('cancel-task-details-btn');

/**
 * Initializes the application on page load.
 * Sets the date picker to the current date, loads tasks, and renders saved dates.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Set the date picker to today's date by default
    const today = new Date();
    currentDate = formatDate(today);
    datePicker.value = currentDate;

    // Firebase Authentication Persistence সেট করা
    // LOCAL মানে ব্রাউজার বন্ধ করলেও সেশন থাকবে
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log("Auth persistence set to LOCAL.");
        })
        .catch((error) => {
            console.error("Error setting persistence:", error.message);
        });


    // Handle user login/logout state
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            loginLogoutBtn.textContent = 'Logout';
            console.log('User logged in:', currentUserId);
            loginModalOverlay.style.display = 'none'; // Hide login modal
            mainContentWrapper.classList.add('authenticated'); // Show main content
            document.body.style.overflow = ''; // Restore body scrolling

            // Load tasks for today once logged in
            const today = new Date();
            currentDate = formatDate(today);
            datePicker.value = currentDate;
            loadTasksForDate(currentDate);
        } else {
            // User is signed out.
            console.log("User logged out.");
            loginModalOverlay.style.display = 'flex'; // Show login modal
            mainContentWrapper.classList.remove('authenticated'); // Hide main content
            document.body.style.overflow = 'hidden'; // Prevent scrolling
            loginEmailInput.value = ''; // Clear inputs
            loginPasswordInput.value = '';
            loginErrorMessage.classList.add('hidden'); // Hide any error messages
            loginEmailInput.focus(); // Focus on email input

            // Clear local tasks data if logged out
            tasksData = {
                study: [],
                skill: [],
                necessary: []
            }; // Reset to empty arrays
            renderAllTasks(); // Clear UI lists
            updateAllProgressBars(); // Reset progress bars
            savedDatesContainer.innerHTML = ''; // Clear saved dates
        }
    });

    // Add event listener for date picker changes
    datePicker.addEventListener('change', (event) => {
        const newDate = event.target.value;
        if (newDate) {
            loadTasksForDate(newDate);
        }
    });

    // Add event listener for Login/Logout button
    loginLogoutBtn.addEventListener('click', async () => {
        if (currentUserId) {
            // Log out
            await auth.signOut();
        } else {
            // This button should actually be handled by the auth.onAuthStateChanged
            // which shows the modal. If we are here, it means we clicked "Login"
            // while logged out, so we'll just open the modal.
            loginModalOverlay.style.display = 'flex';
            loginEmailInput.focus();
        }
    });

    // Handle login form submission
    loginSubmitBtn.addEventListener('click', async () => {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        loginErrorMessage.classList.add('hidden'); // Hide previous errors

        if (email && password) {
            try {
                await auth.signInWithEmailAndPassword(email, password);
                // Auth state change will be handled by onAuthStateChanged listener
            } catch (error) {
                console.error("Login failed:", error.message);
                loginErrorMessage.textContent = error.message;
                loginErrorMessage.classList.remove('hidden');
            }
        } else {
            loginErrorMessage.textContent = "Email and password are required.";
            loginErrorMessage.classList.remove('hidden');
        }
    });

    // Allow login on Enter key press in password field
    loginPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            loginSubmitBtn.click();
        }
    });


    // Add event listeners for the Reading Funnel modal
    openReadingFunnelBtn.addEventListener('click', openReadingFunnelModal);
    closeReadingFunnelBtn.addEventListener('click', closeReadingFunnelModal);
    readingFunnelModal.addEventListener('click', (event) => {
        if (event.target === readingFunnelModal) {
            closeReadingFunnelModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !readingFunnelModal.classList.contains('hidden')) {
            closeReadingFunnelModal();
        }
    });

    // Add event listeners for the Task Details modal (UPDATED)
    closeTaskDetailsBtn.addEventListener('click', closeTaskDetailsModal);
    cancelTaskDetailsBtn.addEventListener('click', closeTaskDetailsModal); // Cancel button does the same as close
    saveTaskDetailsBtn.addEventListener('click', saveTaskDetails);

    addTaskPointBtn.addEventListener('click', addTaskPoint); // NEW
    newTaskPointInput.addEventListener('keydown', (e) => { // NEW
        if (e.key === 'Enter') {
            addTaskPoint();
        }
    });

    taskDetailsModal.addEventListener('click', (event) => {
        if (event.target === taskDetailsModal) { // Clicked outside the content
            closeTaskDetailsModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !taskDetailsModal.classList.contains('hidden')) {
            closeTaskDetailsModal();
        }
    });


    // Event listeners for success modal
    closeSuccessModalBtn.addEventListener('click', closeSuccessModal);
    successModalOverlay.addEventListener('click', (event) => {
        if (event.target === successModalOverlay) {
            closeSuccessModal();
        }
    });


    // Event listeners for adding tasks when Enter key is pressed
    taskInputs.study.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTask('study');
        }
    });
    taskInputs.skill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTask('skill');
        }
    });
    taskInputs.necessary.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTask('necessary');
        }
    });

    // Global click listener to hide context menu
    document.addEventListener('click', (e) => {
        if (currentContextMenu && !currentContextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
});

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

/**
 * Formats a Date object into a YYYY-MM-DD string.
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string into a DD-MM-YYYY string for display.
 * @param {string} dateString - The date string in YYYY-MM-DD format.
 * @returns {string} The formatted date string in DD-MM-YYYY format.
 */
function formatDateForDisplay(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
}

/**
 * Loads tasks for a specific date from Firestore and updates the UI.
 * If no tasks exist for the date, initializes an empty structure.
 * @param {string} date - The date string (YYYY-MM-DD) to load tasks for.
 */
async function loadTasksForDate(date) {
    showLoading();
    currentDate = date;
    datePicker.value = currentDate;
    console.log(`Attempting to load tasks for date: ${date}`);

    try {
        if (typeof db === 'undefined' || db === null) {
            throw new Error("Firestore database (db) not initialized. Check Firebase setup.");
        }

        // Determine which user's data to load.
        const targetUserId = currentUserId;

        if (!targetUserId) {
            console.log("No user ID found to load tasks. Displaying empty tasks.");
            tasksData = {
                study: [],
                skill: [],
                necessary: []
            };
            renderAllTasks();
            updateAllProgressBars();
            savedDatesContainer.innerHTML = ''; // Clear saved dates if not logged in
            hideLoading();
            return; // Exit if no user
        }

        const docRef = db.collection("users").doc(targetUserId).collection("tasks").doc(currentDate);
        console.log(`Fetching document: users/${targetUserId}/tasks/${currentDate}`);
        const doc = await docRef.get();

        if (doc.exists) {
            tasksData = doc.data(); // Load all data for the current date into tasksData
            console.log("Document data received:", tasksData);
            // Migration: If 'self' exists but 'necessary' doesn't, migrate it
            if (tasksData.self && !tasksData.necessary) {
                console.log("Migrating 'self' tasks to 'necessary'.");
                tasksData.necessary = tasksData.self;
                delete tasksData.self;
                if (currentUserId) { // Only save if user is logged in
                    await docRef.set(tasksData); // Save migrated data back to Firestore
                    console.log("Migration complete and saved.");
                }
            }

            // Ensure all sections exist
            ['study', 'skill', 'necessary'].forEach(section => {
                if (!tasksData[section]) {
                    tasksData[section] = [];
                }
            });

            // Migration for task details: string to array of objects (UPDATED)
            ['study', 'skill', 'necessary'].forEach(section => {
                tasksData[section] = tasksData[section].map(task => {
                    let detailsArray = [];
                    if (task.details === undefined || task.details === null) {
                        // Task from before 'details' field existed or was null
                        detailsArray = [];
                    } else if (typeof task.details === 'string') {
                        // Task with old string 'details'
                        if (task.details.trim() !== '') {
                            // Split by newline and create point objects
                            detailsArray = task.details.split('\n').filter(line => line.trim() !== '').map(line => ({
                                text: line.trim(),
                                done: false
                            }));
                        } else {
                            detailsArray = [];
                        }
                    } else if (Array.isArray(task.details)) {
                        // Already in the new format, ensure 'done' status exists for each point
                        detailsArray = task.details.map(point => ({
                            text: point.text || '', // Ensure text exists
                            done: point.done !== undefined ? point.done : false // Ensure done status exists
                        }));
                    }
                    return {
                        ...task,
                        details: detailsArray // Assign the converted array
                    };
                });
            });

        } else {
            console.log(`No document found for date: ${date}. Initializing new data.`);
            tasksData = {
                study: [],
                skill: [],
                necessary: []
            };
            // If not logged in, we don't save an empty doc immediately.
            // It will be saved when the first task is added (which requires login).
        }

        renderAllTasks();
        updateAllProgressBars();
        renderSavedDates();
        console.log("Tasks loaded and rendered successfully.");
    } catch (e) {
        console.error("Error loading tasks: ", e);
        alert("Error loading tasks. Check browser console for details.");
        // Ensure UI is cleared on error
        tasksData = {
            study: [],
            skill: [],
            necessary: []
        };
        renderAllTasks();
        updateAllProgressBars();
        savedDatesContainer.innerHTML = '';
    } finally {
        hideLoading();
    }
}

/**
 * Saves the current tasksData object for the current date to Firestore.
 * Only allows saving if a user is logged in.
 */
async function saveTasks() {
    if (!currentUserId) {
        console.log("Not logged in. Cannot save tasks to Firestore.");
        // We'll let the user know via the login modal if not already.
        return;
    }

    try {
        const docRef = db.collection("users").doc(currentUserId).collection("tasks").doc(currentDate);
        await docRef.set(tasksData);
        console.log("Tasks saved to Firestore for user:", currentUserId);
        renderSavedDates(); // Update saved dates list after saving
    } catch (error) {
        console.error("Error saving tasks to Firestore:", error);
        alert("Error saving tasks: " + error.message);
    }
}

/**
 * Adds a new task to the specified section for the current date.
 * Requires login to add tasks.
 * @param {string} sectionType - The type of section ('study', 'skill', 'necessary').
 */
async function addTask(sectionType) {
    if (!currentUserId) {
        alert("Please log in to add tasks.");
        return;
    }

    const inputElement = taskInputs[sectionType];
    const taskText = inputElement.value.trim();

    if (taskText) {
        tasksData[sectionType].push({
            text: taskText,
            done: false,
            details: [] // Initialize with empty array for details (UPDATED)
        });
        inputElement.value = ''; // Clear the input field
        await saveTasks(); // Save changes to Firestore
        renderTasks(sectionType); // Re-render tasks for the specific section
        updateProgressBar(sectionType); // Update progress bar
    }
}

/**
 * Toggles the 'done' status of a task.
 * Requires login to modify tasks.
 * @param {string} sectionType - The type of section.
 * @param {number} index - The index of the task in the array.
 */
async function toggleTaskDone(sectionType, index) {
    if (!currentUserId) {
        alert("Please log in to modify tasks.");
        return;
    }

    if (tasksData[sectionType] && tasksData[sectionType][index]) {
        tasksData[sectionType][index].done = !tasksData[sectionType][index].done;
        await saveTasks();
        renderTasks(sectionType);
        updateProgressBar(sectionType);
    }
}

/**
 * Deletes a task from the specified section with triple confirmation.
 * Requires login to delete tasks.
 * @param {string} sectionType - The type of section.
 * @param {number} index - The index of the task in the array.
 */
async function deleteTask(sectionType, index) {
    if (!currentUserId) {
        alert("Please log in to delete tasks.");
        return;
    }

    // First confirmation
    if (confirm('Are you absolutely sure you want to delete this task?')) {
        // Second confirmation
        if (confirm('This action cannot be undone. Confirm deletion again?')) {
            // Third and final confirmation
            if (confirm('Last chance! Are you REALLY sure you want to delete this?')) {
                // Perform deletion
                if (tasksData[sectionType] && tasksData[sectionType][index]) {
                    tasksData[sectionType].splice(index, 1);
                    await saveTasks();
                    renderTasks(sectionType);
                    updateProgressBar(sectionType);
                    alert('Task deleted successfully.');
                }
            } else {
                alert('Deletion cancelled.');
            }
        } else {
            alert('Deletion cancelled.');
        }
    } else {
        alert('Deletion cancelled.');
    }
}

/**
 * Displays a custom context menu for editing/deleting a task.
 * @param {Event} event - The mouse event (right-click).
 * @param {string} sectionType - The type of section.
 * @param {number} index - The index of the task.
 * @param {HTMLElement} listItem - The HTML element of the task item.
 */
function showEditContextMenu(event, sectionType, index, listItem) {
    // Remove any existing context menu
    if (currentContextMenu) {
        currentContextMenu.remove();
        currentContextMenu = null;
    }

    const contextMenu = document.createElement('div');
    contextMenu.className = 'custom-context-menu';

    contextMenu.innerHTML = `
        <div class="context-menu-item" data-action="edit">Edit Task Text</div>
        <div class="context-menu-item" data-action="details">Edit Task Details</div>
        <div class="context-menu-item" data-action="delete">Delete Task</div>
    `;

    // Position the menu
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;

    document.body.appendChild(contextMenu);
    currentContextMenu = contextMenu;

    // Add event listeners for menu items
    contextMenu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        hideContextMenu();
        editTask(sectionType, index, listItem);
    });

    contextMenu.querySelector('[data-action="details"]').addEventListener('click', () => {
        hideContextMenu();
        openTaskDetailsModal(sectionType, index); // Open the new details modal
    });

    contextMenu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        hideContextMenu();
        deleteTask(sectionType, index); // Use existing deleteTask function
    });

    // No need to add document click listener here, it's global now
}

/**
 * Hides the custom context menu if it's open.
 */
function hideContextMenu() {
    if (currentContextMenu) {
        currentContextMenu.remove();
        currentContextMenu = null;
    }
}

/**
 * Enters edit mode for a task, replacing its text with an input field.
 * @param {string} sectionType - The type of section.
 * @param {number} index - The index of the task.
 * @param {HTMLElement} listItem - The HTML element of the task item.
 */
async function editTask(sectionType, index, listItem) {
    if (!currentUserId) {
        alert("Please log in to edit tasks.");
        return;
    }

    const taskSpan = listItem.querySelector('.task-text');
    const originalText = tasksData[sectionType][index].text;

    // Create an input field
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.value = originalText;
    inputField.className = 'edit-task-input'; // Add a class for styling

    // Replace the task text span with the input field
    taskSpan.parentNode.replaceChild(inputField, taskSpan);
    inputField.focus();
    inputField.select(); // Select all text for easy editing

    const saveChanges = async () => {
        const newText = inputField.value.trim();
        if (newText && newText !== originalText) {
            tasksData[sectionType][index].text = newText;
            await saveTasks(); // Save to Firestore
        }
        renderTasks(sectionType); // Re-render the specific section
    };

    // Save on Enter key press
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveChanges();
        }
    });

    // Save on losing focus (click outside)
    inputField.addEventListener('blur', saveChanges);
}

/**
 * Renders (or re-renders) the tasks for a given section.
 * Clears the existing list and appends new list items based on current data.
 * @param {string} sectionType - The type of section ('study', 'skill', 'necessary').
 */
function renderTasks(sectionType) {
    const listElement = taskLists[sectionType];
    listElement.innerHTML = ''; // Clear current list

    const tasks = tasksData[sectionType] || []; // Get tasks for the current section from tasksData

    tasks.forEach((task, index) => {
        const listItem = document.createElement('li');
        listItem.className = `task-item ${task.done ? 'done' : ''}`;

        // Create the task text span
        const taskTextSpan = document.createElement('span');
        taskTextSpan.className = 'flex-grow text-gray-800 task-text';
        taskTextSpan.textContent = task.text;
        taskTextSpan.style.cursor = 'pointer'; // Indicate clickability
        taskTextSpan.addEventListener('click', () => {
            openTaskDetailsModal(sectionType, index);
        });

        // Add right-click event listener for editing
        listItem.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent default browser context menu
            showEditContextMenu(e, sectionType, index, listItem);
        });

        // Create buttons
        const toggleBtn = document.createElement('button');
        toggleBtn.className = "icon-button toggle-button";
        toggleBtn.onclick = () => toggleTaskDone(sectionType, index);
        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "icon-button delete-button";
        deleteBtn.onclick = () => deleteTask(sectionType, index);
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucuce-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = "flex items-center gap-2";
        buttonContainer.appendChild(toggleBtn);
        buttonContainer.appendChild(deleteBtn);

        // Append elements to the listItem
        listItem.appendChild(taskTextSpan);
        listItem.appendChild(buttonContainer);

        listElement.appendChild(listItem);
    });

    initializeSortable(sectionType); // Enable drag & drop after rendering
}

/**
 * Renders all tasks for the current date across all sections.
 */
function renderAllTasks() {
    renderTasks('study');
    renderTasks('skill');
    renderTasks('necessary');
}


/**
 * Renders buttons for all dates that have saved tasks for the current user.
 */
async function renderSavedDates() {
    savedDatesContainer.innerHTML = ''; // Clear existing buttons
    showLoading();

    try {
        if (!currentUserId) {
            // If not logged in, no saved dates to show from user's data
            console.log("Not logged in. Cannot render saved dates.");
            hideLoading();
            return;
        }

        const userTasksCollectionRef = db.collection("users").doc(currentUserId).collection("tasks");
        const querySnapshot = await userTasksCollectionRef.get();

        const savedDates = [];
        querySnapshot.forEach(doc => {
            // Check if the document has any actual tasks
            const data = doc.data();
            if ((data.study && data.study.length > 0) ||
                (data.skill && data.skill.length > 0) ||
                (data.necessary && data.necessary.length > 0) ||
                (data.self && data.self.length > 0) // Check old 'self' too for completeness
            ) {
                savedDates.push(doc.id); // doc.id is the date string
            }
        });
        savedDates.sort(); // Sort dates chronologically

        savedDates.forEach(date => {
            const dateItem = document.createElement('div');
            dateItem.className = 'saved-date-item';

            const dateButton = document.createElement('button');
            dateButton.className = `date-button ${date === currentDate ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`;
            dateButton.textContent = formatDateForDisplay(date);
            dateButton.onclick = () => loadTasksForDate(date);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'icon-button delete-button';
            deleteButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-circle">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m15 9-6 6"/>
                    <path d="m9 9 6 6"/>
                </svg>
            `;
            deleteButton.title = `Delete all tasks for ${date}`;
            deleteButton.onclick = async (event) => {
                event.stopPropagation();
                await deleteDateEntry(date);
            };

            dateItem.appendChild(dateButton);
            dateItem.appendChild(deleteButton);
            savedDatesContainer.appendChild(dateItem);
        });

    } catch (error) {
        console.error("Error rendering saved dates:", error);
        alert("Error fetching saved dates: " + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Deletes all tasks for a specific date entry with triple confirmation.
 * Requires login.
 * @param {string} dateToDelete - The date string (YYYY-MM-DD) whose entry needs to be deleted.
 */
async function deleteDateEntry(dateToDelete) {
    if (!currentUserId) {
        alert("Please log in to delete task entries.");
        return;
    }
    // Triple confirmation for deletion
    if (confirm(`Are you absolutely sure you want to delete ALL tasks for ${formatDateForDisplay(dateToDelete)}?`) &&
        confirm('This action cannot be undone and all tasks for this date will be permanently lost. Confirm deletion again?') &&
        confirm('Final Warning! Are you REALLY sure you want to delete all tasks for this date?')
    ) {
        showLoading();
        try {
            const docRef = db.collection("users").doc(currentUserId).collection("tasks").doc(dateToDelete);
            await docRef.delete();
            console.log(`Document ${dateToDelete} successfully deleted for user ${currentUserId}`);

            // If the currently selected date was deleted, reset UI
            if (dateToDelete === currentDate) {
                currentDate = formatDate(new Date());
                datePicker.value = currentDate;
                tasksData = {
                    study: [],
                    skill: [],
                    necessary: []
                }; // Clear local data
                renderAllTasks(); // Render empty lists
                updateAllProgressBars();
            }
            await renderSavedDates(); // Re-render saved dates
            alert(`All tasks for ${formatDateForDisplay(dateToDelete)} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting date entry:", error);
            alert("Error deleting date entry: " + error.message);
        } finally {
            hideLoading();
        }
    } else {
        alert('Deletion cancelled.');
    }
}

/**
 * Displays a custom success modal with message and confetti.
 * @param {string} sectionType - The type of section completed.
 */
function showSuccessModal(sectionType) {
    successModalTitle.textContent = 'Congratulations! 🎉🥳';
    successModalMessage.textContent = `You've completed all tasks in the ${sectionType.toUpperCase()} section!`;
    successModalOverlay.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent scrolling

    // Generate confetti
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.top = `${-20 - Math.random() * 50}px`; // Start above screen
        confetti.style.setProperty('--x', `${(Math.random() - 0.5) * 400}px`);
        confetti.style.setProperty('--y', `${window.innerHeight + 100}px`);
        confetti.style.setProperty('--deg', `${Math.random() * 360}deg`);
        confetti.style.animationDelay = `${Math.random() * 0.8}s`;
        document.body.appendChild(confetti);

        // Remove confetti after animation
        confetti.addEventListener('animationend', () => {
            confetti.remove();
        });
    }
}

/**
 * Closes the custom success modal.
 */
function closeSuccessModal() {
    successModalOverlay.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
    // Remove any lingering confetti
    document.querySelectorAll('.confetti').forEach(c => c.remove());
}

/**
 * Updates the progress bar for a given section.
 * Also adds emoji and plays audio/shows popup on 100% completion.
 * @param {string} sectionType - The type of section ('study', 'skill', 'necessary').
 */
function updateProgressBar(sectionType) {
    const tasks = tasksData[sectionType] || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.done).length;

    const progressBarFill = progressBars[sectionType].fill;
    const progressBarText = progressBars[sectionType].text;

    let percentage = 0;
    if (totalTasks > 0) {
        percentage = Math.round((completedTasks / totalTasks) * 100);
    }

    progressBarFill.style.width = `${percentage}%`;

    let emoji = '';
    if (percentage === 0 && totalTasks > 0) {
        emoji = '😭'; // Saddest
    } else if (percentage > 0 && percentage <= 25) {
        emoji = '😔'; // Sad
    } else if (percentage > 25 && percentage <= 50) {
        emoji = '😐'; // Neutral
    } else if (percentage > 50 && percentage <= 75) {
        emoji = '😊'; // Happy
    } else if (percentage > 75 && percentage < 100) {
        emoji = '💪'; // Very good / Strong
    } else if (percentage === 100 && totalTasks > 0) {
        emoji = '🎉'; // Celebration
    } else {
        emoji = ''; // No tasks
    }


    progressBarText.textContent = `${percentage}% ${emoji}`; // Only percentage and emoji

    // Adjust text color based on progress for better readability
    if (percentage > 50) {
        progressBarText.style.color = 'white';
    } else {
        progressBarText.style.color = '#4a5568';
    }

    // Play audio and show popup on 100% completion
    if (percentage === 100 && totalTasks > 0) {
        const audio = document.getElementById('success-audio');
        if (audio) {
            audio.play().catch(e => console.error("Error playing audio:", e));
        }
        setTimeout(() => {
            // Only show success modal if the current date is "today"
            // to avoid showing old completion alerts when navigating dates.
            const today = new Date();
            const formattedToday = formatDate(today);
            if (currentDate === formattedToday) {
                showSuccessModal(sectionType);
            }
        }, 100); // Small delay to ensure audio plays
    }
}

/**
 * Updates all progress bars.
 */
function updateAllProgressBars() {
    updateProgressBar('study');
    updateProgressBar('skill');
    updateProgressBar('necessary');
}

// --- Reading Funnel Modal Functions ---
function openReadingFunnelModal() {
    readingFunnelModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeReadingFunnelModal() {
    readingFunnelModal.classList.add('hidden');
    document.body.style.overflow = '';
}

// --- Task Details Modal Functions (UPDATED) ---
function openTaskDetailsModal(sectionType, index) {
    if (!currentUserId) {
        alert("Please log in to view/edit task details.");
        return;
    }

    currentTaskSection = sectionType;
    currentTaskIndex = index;

    // Clear previous points and populate
    renderTaskPoints();

    taskDetailsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    newTaskPointInput.focus(); // Focus on the new point input
}

function renderTaskPoints() {
    const task = tasksData[currentTaskSection][currentTaskIndex];
    const details = task.details || []; // Ensure it's an array

    taskPointsList.innerHTML = ''; // Clear current points list

    if (details.length === 0) {
        taskPointsList.innerHTML = '<p class="text-gray-500 italic">No sub-points added yet.</p>';
        return;
    }

    details.forEach((point, pointIndex) => {
        const pointItem = document.createElement('div');
        pointItem.className = 'task-point-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = point.done;
        checkbox.id = `task-point-${pointIndex}`;
        checkbox.addEventListener('change', () => toggleTaskPointDone(pointIndex));

        const pointTextSpan = document.createElement('span');
        pointTextSpan.className = `task-point-text flex-grow ${point.done ? 'done' : ''}`;
        pointTextSpan.textContent = `${pointIndex + 1}. ${point.text}`; // Auto-numbering

        const deleteButton = document.createElement('button');
        deleteButton.className = 'icon-button delete-button';
        deleteButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucuce-trash-2">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
            </svg>
        `;
        deleteButton.title = "Delete this sub-point";
        deleteButton.addEventListener('click', () => deleteTaskPoint(pointIndex));

        pointItem.appendChild(checkbox);
        pointItem.appendChild(pointTextSpan);
        pointItem.appendChild(deleteButton);

        taskPointsList.appendChild(pointItem);
    });
}


function addTaskPoint() {
    const newPointText = newTaskPointInput.value.trim();
    if (newPointText) {
        const task = tasksData[currentTaskSection][currentTaskIndex];
        if (!task.details) {
            task.details = []; // Ensure details is an array
        }
        task.details.push({
            text: newPointText,
            done: false
        });
        newTaskPointInput.value = ''; // Clear input
        renderTaskPoints(); // Re-render points list in modal
        // Saving will happen when the main 'Save' button is clicked
    }
}

function toggleTaskPointDone(pointIndex) {
    const task = tasksData[currentTaskSection][currentTaskIndex];
    if (task.details && task.details[pointIndex]) {
        task.details[pointIndex].done = !task.details[pointIndex].done;
        renderTaskPoints(); // Re-render to update checkbox and text style
        // Saving will happen when the main 'Save' button is clicked
    }
}

function deleteTaskPoint(pointIndex) {
    const task = tasksData[currentTaskSection][currentTaskIndex];
    if (task.details && task.details[pointIndex]) {
        if (confirm('Are you sure you want to delete this sub-point?')) {
            task.details.splice(pointIndex, 1);
            renderTaskPoints(); // Re-render to update list
            // Saving will happen when the main 'Save' button is clicked
        }
    }
}

async function saveTaskDetails() {
    if (currentTaskSection === null || currentTaskIndex === null) {
        console.error("No task selected for saving details.");
        return;
    }
    // The taskData.details array is already updated by addTaskPoint, toggleTaskPointDone, deleteTaskPoint
    await saveTasks(); // Persist all changes to Firestore
    closeTaskDetailsModal();
}

function closeTaskDetailsModal() {
    taskDetailsModal.classList.add('hidden');
    document.body.style.overflow = '';
    currentTaskSection = null;
    currentTaskIndex = null;
    newTaskPointInput.value = ''; // Clear input field
    taskPointsList.innerHTML = ''; // Clear rendered points
}

// --- SortableJS Initialization (Keep existing) ---
function initializeSortable(sectionType) {
    const listElement = taskLists[sectionType];
    Sortable.create(listElement, {
        animation: 150,
        handle: '.task-text', // Only drag by the text part
        onEnd: async function (evt) {
            if (!currentUserId) return;
            const newOrder = [];
            const items = listElement.querySelectorAll('li');
            items.forEach(item => {
                const text = item.querySelector('.task-text').textContent.trim();
                // Find the original task object by text (this might be problematic if texts are not unique)
                // A better approach would be to store original index or a unique ID.
                // For now, let's assume text is unique enough for reordering.
                const original = tasksData[sectionType].find(t => t.text === text);
                if (original) newOrder.push(original);
            });
            tasksData[sectionType] = newOrder;
            await saveTasks();
            renderTasks(sectionType); // Optional re-render for clean DOM
        }
    });
}