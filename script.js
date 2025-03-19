/**
 * E-Commerce Chatbot Interface
 * 
 * This script handles the chatbot UI interactions, natural language processing,
 * and communication with the proxy server.
 */

// Configuration
const CONFIG = {
    // Use environment variable if available, otherwise fallback to localhost
    PROXY_SERVER_URL: typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') // Remove trailing slash if present
        : 'http://localhost:3000',
    RETRY_DELAY: 2000,
    MAX_RETRIES: 3
};

// Helper function to join URL paths without double slashes
function joinUrl(base, path) {
    // Remove trailing slash from base if present
    const cleanBase = base.replace(/\/$/, '');
    // Remove leading slash from path if present
    const cleanPath = path.replace(/^\//, '');
    // Join with a single slash
    return `${cleanBase}/${cleanPath}`;
}

// DOM Elements
const elements = {
    platformSelect: document.getElementById('platform'),
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendButton: document.getElementById('send-button'),
    cartItems: document.getElementById('cart-items'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    apiStatus: document.getElementById('api-status'),
    errorModal: document.getElementById('error-modal'),
    errorMessage: document.getElementById('error-message'),
    errorDetails: document.getElementById('error-details'),
    dismissError: document.getElementById('dismiss-error'),
    closeModal: document.getElementById('close-modal')
};

// State Management
const state = {
    connected: false,
    platform: 'motonet',
    cart: [],
    retryCount: 0,
    retryTimeout: null
};

/**
 * Initialize the application
 */
function init() {
    // Add event listeners
    elements.sendButton.addEventListener('click', handleSendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    elements.platformSelect.addEventListener('change', handlePlatformChange);
    elements.dismissError.addEventListener('click', closeErrorModal);
    elements.closeModal.addEventListener('click', closeErrorModal);
    
    // Check proxy server connection
    checkProxyServerConnection();
    
    // Focus on input field
    elements.messageInput.focus();
}

/**
 * Check if the proxy server is running
 */
async function checkProxyServerConnection() {
    try {
        const response = await fetch(joinUrl(CONFIG.PROXY_SERVER_URL, 'health'), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateConnectionStatus(true, data);
            state.retryCount = 0;
            clearTimeout(state.retryTimeout);
        } else {
            throw new Error(`Server responded with status: ${response.status}`);
        }
    } catch (error) {
        updateConnectionStatus(false, { error: error.message });
        
        // Retry connection
        if (state.retryCount < CONFIG.MAX_RETRIES) {
            state.retryCount++;
            state.retryTimeout = setTimeout(checkProxyServerConnection, CONFIG.RETRY_DELAY);
        }
    }
}

/**
 * Update the connection status UI
 */
function updateConnectionStatus(connected, data) {
    state.connected = connected;
    
    if (connected) {
        elements.statusDot.classList.remove('offline');
        elements.statusDot.classList.add('online');
        elements.statusText.textContent = 'Connected';
        
        // Update platform from server if available
        if (data.currentPlatform) {
            state.platform = data.currentPlatform;
            elements.platformSelect.value = data.currentPlatform;
        }
        
        // Check cookie status
        const platformKey = state.platform.toUpperCase();
        const cookieStatus = data.cookieStatus && data.cookieStatus[state.platform];
        
        if (cookieStatus) {
            elements.apiStatus.textContent = `Connected to ${state.platform} API`;
        } else {
            elements.apiStatus.textContent = `Warning: Missing cookies for ${state.platform}`;
        }
    } else {
        elements.statusDot.classList.remove('online');
        elements.statusDot.classList.add('offline');
        elements.statusText.textContent = 'Disconnected';
        elements.apiStatus.textContent = 'API server not responding';
    }
}

/**
 * Handle platform change
 */
async function handlePlatformChange() {
    const newPlatform = elements.platformSelect.value;
    
    if (newPlatform === state.platform) return;
    
    try {
        const response = await fetch(joinUrl(CONFIG.PROXY_SERVER_URL, 'api/switch-platform'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: newPlatform })
        });
        
        if (response.ok) {
            const data = await response.json();
            state.platform = data.currentPlatform;
            
            // Add system message
            addMessage('bot', `Switched to ${state.platform} store. How can I help you shop today?`);
            
            // Check connection again to update status
            checkProxyServerConnection();
        } else {
            throw new Error(`Failed to switch platform: ${response.status}`);
        }
    } catch (error) {
        showError('Platform Switch Error', error.message);
    }
}

/**
 * Handle send message button click
 */
function handleSendMessage() {
    const message = elements.messageInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessage('user', message);
    
    // Clear input
    elements.messageInput.value = '';
    
    // Process the message
    processUserMessage(message);
}

/**
 * Add a message to the chat
 */
function addMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    
    contentDiv.appendChild(paragraph);
    messageDiv.appendChild(contentDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Process user message and generate response
 */
async function processUserMessage(message) {
    // Check connection first
    if (!state.connected) {
        addMessage('bot', 'Sorry, I cannot process your request because I\'m not connected to the server. Please check your connection and try again.');
        return;
    }
    
    // Simple NLP to detect add to cart intent
    const addToCartRegex = /add\s+(?:(\d+)\s+)?(?:of\s+)?(?:the\s+)?(.+?)(?:\s+to\s+(?:my\s+)?cart)?$/i;
    const productIdRegex = /product\s+(?:id\s+)?(?:is\s+)?([a-zA-Z0-9\-]+)/i;
    
    let quantity = 1;
    let productName = '';
    let productId = '';
    
    // Check for add to cart intent
    const addToCartMatch = message.match(addToCartRegex);
    if (addToCartMatch) {
        if (addToCartMatch[1]) {
            quantity = parseInt(addToCartMatch[1], 10);
        }
        productName = addToCartMatch[2];
        
        // Look for product ID in the message
        const productIdMatch = message.match(productIdRegex);
        if (productIdMatch) {
            productId = productIdMatch[1];
        } else {
            // If no product ID found, use a mock ID based on the product name
            // In a real implementation, this would query a product database
            productId = mockProductIdFromName(productName);
        }
        
        // Add thinking message
        addMessage('bot', `I'll try to add ${quantity} ${productName} to your cart...`);
        
        // Call the API to add to cart
        await addToCart(productId, quantity, productName);
    } else {
        // Handle other types of messages
        handleGeneralMessage(message);
    }
}

/**
 * Generate a mock product ID from a product name
 * In a real implementation, this would query a product database
 */
function mockProductIdFromName(name) {
    // For Motonet, product IDs are often in the format XX-XXXX
    if (state.platform === 'motonet') {
        const firstPart = Math.floor(Math.random() * 90) + 10;
        const secondPart = Math.floor(Math.random() * 9000) + 1000;
        return `${firstPart}-${secondPart}`;
    }
    
    // For Rusta, use a different format
    if (state.platform === 'rusta') {
        return `P${Math.floor(Math.random() * 900000) + 100000}`;
    }
    
    // Default format
    return `PROD-${Math.floor(Math.random() * 90000) + 10000}`;
}

/**
 * Add product to cart via API
 */
async function addToCart(productId, quantity, productName) {
    try {
        const response = await fetch(joinUrl(CONFIG.PROXY_SERVER_URL, 'api/add-to-cart'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Success message
            addMessage('bot', `Great! I've added ${quantity} ${productName} to your cart.`);
            
            // Update cart UI
            updateCart(productId, productName, quantity);
        } else {
            // Error message
            let errorMsg = 'Sorry, I couldn\'t add that item to your cart.';
            
            if (data.error) {
                if (data.error.includes('cookie') || data.error.includes('authentication')) {
                    errorMsg += ' It seems there might be an authentication issue.';
                } else if (data.error.includes('not found') || data.error.includes('invalid product')) {
                    errorMsg += ' The product might not exist or the ID might be incorrect.';
                }
            }
            
            addMessage('bot', errorMsg);
            
            // Show detailed error in modal
            showError('Add to Cart Error', errorMsg, data);
        }
    } catch (error) {
        addMessage('bot', 'Sorry, there was an error connecting to the server. Please try again later.');
        showError('Connection Error', error.message);
    }
}

/**
 * Update the cart UI
 */
function updateCart(productId, productName, quantity) {
    // Remove empty cart message if present
    const emptyCartMsg = elements.cartItems.querySelector('.empty-cart');
    if (emptyCartMsg) {
        elements.cartItems.removeChild(emptyCartMsg);
    }
    
    // Check if product already in cart
    const existingItem = state.cart.find(item => item.id === productId);
    
    if (existingItem) {
        // Update quantity
        existingItem.quantity += quantity;
        
        // Update UI
        const itemElement = elements.cartItems.querySelector(`[data-product-id="${productId}"]`);
        const quantityElement = itemElement.querySelector('.item-quantity');
        quantityElement.textContent = existingItem.quantity;
    } else {
        // Add new item to state
        state.cart.push({
            id: productId,
            name: productName,
            quantity: quantity
        });
        
        // Create new cart item element
        const itemElement = document.createElement('div');
        itemElement.classList.add('cart-item');
        itemElement.setAttribute('data-product-id', productId);
        
        const itemName = document.createElement('span');
        itemName.classList.add('item-name');
        itemName.textContent = productName;
        
        const itemQuantity = document.createElement('span');
        itemQuantity.classList.add('item-quantity');
        itemQuantity.textContent = quantity;
        
        const itemRemove = document.createElement('button');
        itemRemove.classList.add('remove-item');
        itemRemove.innerHTML = '&times;';
        itemRemove.addEventListener('click', () => removeFromCart(productId));
        
        itemElement.appendChild(itemName);
        itemElement.appendChild(document.createTextNode(' × '));
        itemElement.appendChild(itemQuantity);
        itemElement.appendChild(itemRemove);
        
        elements.cartItems.appendChild(itemElement);
    }
}

/**
 * Remove item from cart
 */
function removeFromCart(productId) {
    // Remove from state
    state.cart = state.cart.filter(item => item.id !== productId);
    
    // Remove from UI
    const itemElement = elements.cartItems.querySelector(`[data-product-id="${productId}"]`);
    if (itemElement) {
        elements.cartItems.removeChild(itemElement);
    }
    
    // Add empty cart message if cart is empty
    if (state.cart.length === 0) {
        const emptyCartMsg = document.createElement('p');
        emptyCartMsg.classList.add('empty-cart');
        emptyCartMsg.textContent = 'Your cart is empty';
        elements.cartItems.appendChild(emptyCartMsg);
    }
}

/**
 * Handle general messages that aren't add-to-cart requests
 */
function handleGeneralMessage(message) {
    // Simple keyword-based responses
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        addMessage('bot', 'Hello! How can I help you with your shopping today?');
    } else if (lowerMessage.includes('help') || lowerMessage.includes('how') && lowerMessage.includes('work')) {
        addMessage('bot', 'I can help you add products to your cart. Just tell me what you want to buy, for example: "Add 2 winter tires to my cart" or "I want to buy a car battery".');
    } else if (lowerMessage.includes('thank')) {
        addMessage('bot', 'You\'re welcome! Is there anything else you\'d like to add to your cart?');
    } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
        addMessage('bot', 'Thank you for shopping with us! Have a great day!');
    } else {
        // Default response for unrecognized messages
        addMessage('bot', 'I\'m designed to help you add products to your cart. Please tell me what you\'d like to buy.');
    }
}

/**
 * Show error modal
 */
function showError(title, message, details = null) {
    elements.errorMessage.textContent = message;
    
    // Clear previous details
    elements.errorDetails.innerHTML = '';
    
    // Add details if available
    if (details) {
        const detailsText = typeof details === 'object' ? JSON.stringify(details, null, 2) : details.toString();
        const pre = document.createElement('pre');
        pre.textContent = detailsText;
        elements.errorDetails.appendChild(pre);
    }
    
    // Show modal
    elements.errorModal.style.display = 'flex';
}

/**
 * Close error modal
 */
function closeErrorModal() {
    elements.errorModal.style.display = 'none';
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
