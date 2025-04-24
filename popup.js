// Get user language preference or detect from browser
let currentLang = localStorage.getItem('language') ||
    (navigator.language.startsWith('pt') ? 'pt' : 'en');

// Update UI language and notify content script
function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);

    // Update UI elements with new translations
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = translations[lang][key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = translations[lang][key];
    });

    // Notify content script about language change
    browser.tabs.query({ active: true, currentWindow: true })
        .then(async (tabs) => {
            if (tabs.length > 0) {
                try {
                    await browser.tabs.sendMessage(tabs[0].id, {
                        type: 'languageChanged',
                        language: lang
                    });
                } catch (error) {
                    // Ignore error if the content script is not active
                    if (!error.message.includes('Receiving end does not exist')) {
                        console.warn('Error updating language:', error);
                    }
                }
            }
        });
}

// Load and display all saved commands
document.getElementById('language-selector').value = currentLang;
document.getElementById('language-selector').addEventListener('change', (e) => {
    updateLanguage(e.target.value);
});

async function loadCommands() {
    try {
        const { commands } = await browser.storage.local.get('commands');
        const commandList = document.getElementById('command-list');
        commandList.innerHTML = '';

        // Show message if no commands exist
        if (!commands || Object.keys(commands).length === 0) {
            commandList.innerHTML = `
                <li style="text-align: center; color: var(--text-secondary);">
                    ${translations[currentLang].noCommands}
                </li>`;
            return;
        }

        // Create list items for each command
        for (const [command, text] of Object.entries(commands)) {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="command-header">
                    <code class="command-code">${command}</code>
                    <button class="delete-btn" data-command="${command}">×</button>
                </div>
                <div class="command-text">${text}</div>
            `;

            // Adicionar evento para deletar comando com confirmação
            li.querySelector('.delete-btn').addEventListener('click', async () => {
                const confirmed = await showConfirmModal(translations[currentLang].confirmDelete);
                if (confirmed) {
                    const { commands } = await browser.storage.local.get('commands');
                    delete commands[command];
                    await browser.storage.local.set({ commands });
                    loadCommands();
                }
            });

            commandList.appendChild(li);
        }
    } catch (error) {
        console.error('Error loading commands:', error);
    }
}

// Handle form submission for adding/updating commands
document.getElementById("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cmd = document.getElementById("command").value.trim();
    const text = document.getElementById("text").value.trim();

    // Check for existing command and confirm replacement
    if (!cmd.startsWith("/")) {
        alert(translations[currentLang].commandMustStartWith);
        return;
    }

    try {
        const { commands } = await browser.storage.local.get('commands');

        if (commands && commands[cmd]) {
            const message = translations[currentLang].commandExists.replace('$1', cmd.substring(1));
            const confirmed = await showConfirmModal(message);
            if (!confirmed) {
                return;
            }
        }

        // Save command and refresh list
        await browser.storage.local.set({
            commands: {
                ...(commands || {}),
                [cmd]: text
            }
        });

        // Clear form and reload commands
        document.getElementById("command").value = '';
        document.getElementById("text").value = '';

        // Recarrega a lista de comandos
        await loadCommands();

    } catch (error) {
        console.error('Error saving command:', error);
    }
});

// Display confirmation modal with Yes/No options
function showConfirmModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const modalMessage = document.getElementById('modal-message');
        const yesButton = document.getElementById('modal-yes');
        const noButton = document.getElementById('modal-no');

        const cleanup = () => {
            modal.style.display = 'none';
            yesButton.removeEventListener('click', handleYes);
            noButton.removeEventListener('click', handleNo);
            document.removeEventListener('keydown', handleEscape);
            modal.removeEventListener('click', handleOutsideClick);
        };

        const handleYes = () => {
            cleanup();
            resolve(true);
        };

        const handleNo = () => {
            cleanup();
            resolve(false);
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };

        const handleOutsideClick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        };

        modalMessage.textContent = message;
        modal.style.display = 'block';

        yesButton.addEventListener('click', handleYes);
        noButton.addEventListener('click', handleNo);
        document.addEventListener('keydown', handleEscape);
        modal.addEventListener('click', handleOutsideClick);
    });
}

// About modal controls
const aboutModal = document.getElementById('about-modal');
const aboutLink = document.getElementById('about-link');
const aboutClose = document.getElementById('about-close');

aboutLink.addEventListener('click', () => {
    aboutModal.style.display = 'block';
});

aboutClose.addEventListener('click', () => {
    aboutModal.style.display = 'none';
});

// Close about modal when clicking outside
aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
        aboutModal.style.display = 'none';
    }
});

// Close about modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aboutModal.style.display === 'block') {
        aboutModal.style.display = 'none';
    }
});

// Initialize extension
updateLanguage(currentLang);
loadCommands();