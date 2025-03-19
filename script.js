/**
 * E-Commerce Chatbot Interface
 * 
 * This script handles the chatbot UI interactions, natural language processing,
 * and communication with the proxy server.
 */

// Configuration
const CONFIG = {
    PROXY_SERVER_URL: 'http://localhost:3000',
    RETRY_DELAY: 2000,
    MAX_RETRIES: 3
};

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
        const response = await fetch(`${CONFIG.PROXY_SERVER_URL}/health`, {
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
        elements.apiStatus.textContent = 'Proxy server not connected';
    }
}

/**
 * Handle platform change
 */
async function handlePlatformChange() {
    const newPlatform = elements.platformSelect.value;
    
    if (newPlatform === state.platform) return;
    
    try {
        const response = await fetch(`${CONFIG.PROXY_SERVER_URL}/api/switch-platform`, {
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
        const response = await fetch(`${CONFIG.PROXY_SERVER_URL}/api/add-to-cart`, {
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
    // Check if product already in cart
    const existingItemIndex = state.cart.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {
        // Update quantity
        state.cart[existingItemIndex].quantity += quantity;
    } else {
        // Add new item
        state.cart.push({ productId, productName, quantity });
    }
    
    // Update UI
    renderCart();
}

/**
 * Render the cart items
 */
function renderCart() {
    // Clear current items
    elements.cartItems.innerHTML = '';
    
    if (state.cart.length === 0) {
        const emptyCart = document.createElement('p');
        emptyCart.classList.add('empty-cart');
        emptyCart.textContent = 'Your cart is empty';
        elements.cartItems.appendChild(emptyCart);
        return;
    }
    
    // Add each item
    state.cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        
        const itemInfo = document.createElement('div');
        itemInfo.classList.add('cart-item-info');
        
        const itemName = document.createElement('div');
        itemName.classList.add('cart-item-name');
        itemName.textContent = item.productName;
        
        const itemId = document.createElement('div');
        itemId.classList.add('cart-item-id');
        itemId.textContent = `ID: ${item.productId}`;
        
        itemInfo.appendChild(itemName);
        itemInfo.appendChild(itemId);
        
        const itemQuantity = document.createElement('div');
        itemQuantity.classList.add('cart-item-quantity');
        itemQuantity.textContent = `Qty: ${item.quantity}`;
        
        cartItem.appendChild(itemInfo);
        cartItem.appendChild(itemQuantity);
        
        elements.cartItems.appendChild(cartItem);
    });
}

/**
 * Handle general messages that aren't add-to-cart requests
 */
function handleGeneralMessage(message) {
    // Simple rule-based responses
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        addMessage('bot', `Hello! I'm your shopping assistant for ${state.platform}. How can I help you today?`);
    }
    else if (lowerMessage.includes('help')) {
        addMessage('bot', 'I can help you add products to your cart. Try saying something like "Add 2 winter tires to my cart" or "Add motor oil product id 59-5064".');
    }
    else if (lowerMessage.includes('thank')) {
        addMessage('bot', 'You\'re welcome! Is there anything else you\'d like to add to your cart?');
    }
    else if (lowerMessage.includes('clear cart') || lowerMessage.includes('empty cart')) {
        state.cart = [];
        renderCart();
        addMessage('bot', 'I\'ve cleared your cart. What would you like to shop for?');
    }
    else {
        addMessage('bot', 'I\'m designed to help you add products to your cart. Try asking me to add a specific product, like "Add winter tires to my cart" or "Add 2 bottles of motor oil".');
    }
}

/**
 * Show error modal
 */
function showError(title, message, details = null) {
    elements.errorMessage.textContent = message;
    
    if (details) {
        elements.errorDetails.textContent = JSON.stringify(details, null, 2);
        elements.errorDetails.style.display = 'block';
    } else {
        elements.errorDetails.style.display = 'none';
    }
    
    elements.errorModal.classList.add('show');
}

/**
 * Close error modal
 */
function closeErrorModal() {
    elements.errorModal.classList.remove('show');
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
