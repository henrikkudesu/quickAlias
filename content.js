(function () {
    // Constants and state
    const COMMAND_REGEX = /\/\w+/;

    // Collection of cleanup functions
    const handlers = [];
    let userLang = localStorage.getItem('language') ||
        (navigator.language.startsWith('pt') ? 'pt' : 'en');

    // Create suggestion box
    const suggestionBox = createSuggestionBox();
    document.body.appendChild(suggestionBox);

    // Event handlers
    const storageHandler = (e) => {
        if (e.key === 'language') {
            userLang = e.newValue;
            if (suggestionBox.style.display === 'block') {
                const currentText = suggestionBox.querySelector('.quick-alias-suggestion__text').textContent;
                showSuggestion(document.activeElement, currentText);
            }
        }
    };

    const inputHandler = async (event) => {
        const el = event.target;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
            const value = el.value || el.innerText;
            const match = value.match(COMMAND_REGEX);

            if (!match) {
                hideSuggestion();
                return;
            }

            const commands = await getCommands();
            const command = match[0];
            const text = commands[command];

            if (text) {
                showSuggestion(el, text);
            } else {
                hideSuggestion();
            }
        }
    };

    const keydownHandler = async (event) => {
        if (event.key === 'Tab' && suggestionBox.style.display === 'block') {
            event.preventDefault();
            const el = event.target;
            const value = el.value || el.innerText;
            const match = value.match(COMMAND_REGEX);

            if (match) {
                const commands = await getCommands();
                const text = commands[match[0]];
                if (text) {
                    replaceCommand(el, match[0], text);
                }
            }
        }
    };

    const messageHandler = (msg) => {
        if (msg.type === 'languageChanged') {
            userLang = msg.language;
            if (suggestionBox.style.display === 'block') {
                const currentText = suggestionBox.querySelector('.quick-alias-suggestion__text').textContent;
                showSuggestion(document.activeElement, currentText);
            }
        }
    };

    // Helper functions
    function createSuggestionBox() {
        const box = document.createElement('div');
        box.className = 'quick-alias-suggestion';
        return box;
    }

    function initTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        applyTheme(mediaQuery.matches);

        const themeHandler = e => applyTheme(e.matches);
        mediaQuery.addEventListener('change', themeHandler);

        // Add cleanup function to handlers collection
        handlers.push(() => mediaQuery.removeEventListener('change', themeHandler));
    }

    function applyTheme(isDark) {
        suggestionBox.classList.remove('quick-alias-suggestion--light', 'quick-alias-suggestion--dark');
        suggestionBox.classList.add(isDark ? 'quick-alias-suggestion--dark' : 'quick-alias-suggestion--light');
    }

    async function getCommands() {
        try {
            const { commands } = await browser.storage.local.get("commands");
            return commands || {};
        } catch (error) {
            console.error(translations[userLang].commandNotFound, error);
            return {};
        }
    }

    function showSuggestion(el, text) {
        const rect = el.getBoundingClientRect();
        suggestionBox.style.left = `${rect.left}px`;
        suggestionBox.style.top = `${rect.bottom + window.scrollY + 5}px`;

        if (!translations[userLang]?.pressTab) {
            console.error(`Translation for "pressTab" not found in "${userLang}"`);
            suggestionBox.innerHTML = '<div>Translation unavailable</div>';
            return;
        }

        suggestionBox.innerHTML = `
            <div class="quick-alias-suggestion__hint">
                ${translations[userLang].pressTab}
            </div>
            <div class="quick-alias-suggestion__text">${text}</div>
        `;
        suggestionBox.style.display = 'block';
    }

    function hideSuggestion() {
        suggestionBox.style.display = 'none';
    }

    function replaceCommand(el, command, text) {
        if (el.isContentEditable) {
            el.innerText = el.innerText.replace(command, text);
        } else {
            el.value = el.value.replace(command, text);
        }
        hideSuggestion();
    }

    // Initialize event listeners
    window.addEventListener('storage', storageHandler);
    document.addEventListener('input', inputHandler);
    document.addEventListener('keydown', keydownHandler);
    browser.runtime.onMessage.addListener(messageHandler);

    // Add cleanup functions
    handlers.push(
        () => window.removeEventListener('storage', storageHandler),
        () => document.removeEventListener('input', inputHandler),
        () => document.removeEventListener('keydown', keydownHandler),
        () => browser.runtime.onMessage.removeListener(messageHandler)
    );

    // Initialize theme
    initTheme();

    // Cleanup on window unload
    window.addEventListener('unload', () => {
        handlers.forEach(cleanup => cleanup());
    });
})();