import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  // State management
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I\'m your shopping assistant. I can help you add products to your cart. What would you like to shop for today?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [platform, setPlatform] = useState('motonet');
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting...');
  const [cart, setCart] = useState([]);
  const [showError, setShowError] = useState(false);
  const [errorDetails, setErrorDetails] = useState({ message: '', details: null });
  
  const messagesEndRef = useRef(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://e-commerce-chatbot-api.herokuapp.com';

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check connection on load
  useEffect(() => {
    checkConnection();
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check API connection
  const checkConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setConnected(true);
        setPlatform(data.currentPlatform || 'motonet');
        
        const platformKey = data.currentPlatform || 'motonet';
        const cookieStatus = data.cookieStatus && data.cookieStatus[platformKey];
        
        if (cookieStatus) {
          setStatusMessage(`Connected to ${platformKey} API`);
        } else {
          setStatusMessage(`Warning: Missing cookies for ${platformKey}`);
        }
      } else {
        setConnected(false);
        setStatusMessage('API server not responding');
      }
    } catch (error) {
      setConnected(false);
      setStatusMessage('Connection error');
    }
  };

  // Handle platform change
  const handlePlatformChange = async (e) => {
    const newPlatform = e.target.value;
    if (newPlatform === platform) return;
    
    try {
      const response = await fetch(`${API_URL}/api/switch-platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: newPlatform })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlatform(data.currentPlatform);
        addMessage('bot', `Switched to ${data.currentPlatform} store. How can I help you shop today?`);
        checkConnection();
      } else {
        showErrorModal('Platform Switch Error', 'Failed to switch platform');
      }
    } catch (error) {
      showErrorModal('Connection Error', error.message);
    }
  };

  // Add message to chat
  const addMessage = (sender, text) => {
    setMessages(prev => [...prev, { sender, text }]);
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    addMessage('user', inputValue);
    processUserMessage(inputValue);
    setInputValue('');
  };

  // Process user message
  const processUserMessage = async (message) => {
    if (!connected) {
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
        productId = mockProductIdFromName(productName);
      }
      
      // Add thinking message
      addMessage('bot', `I'll try to add ${quantity} ${productName} to your cart...`);
      
      // Call the API to add to cart
      await addToCart(productId, quantity, productName);
    } else if (message.toLowerCase().includes('clear cart') || message.toLowerCase().includes('empty cart')) {
      setCart([]);
      addMessage('bot', 'I\'ve cleared your cart. What would you like to shop for?');
    } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi') || message.toLowerCase().includes('hey')) {
      addMessage('bot', `Hello! I'm your shopping assistant for ${platform}. How can I help you today?`);
    } else if (message.toLowerCase().includes('help')) {
      addMessage('bot', 'I can help you add products to your cart. Try saying something like "Add 2 winter tires to my cart" or "Add motor oil product id 59-5064".');
    } else if (message.toLowerCase().includes('thank')) {
      addMessage('bot', 'You\'re welcome! Is there anything else you\'d like to add to your cart?');
    } else {
      addMessage('bot', 'I\'m designed to help you add products to your cart. Try asking me to add a specific product, like "Add winter tires to my cart" or "Add 2 bottles of motor oil".');
    }
  };

  // Generate mock product ID
  const mockProductIdFromName = (name) => {
    if (platform === 'motonet') {
      const firstPart = Math.floor(Math.random() * 90) + 10;
      const secondPart = Math.floor(Math.random() * 9000) + 1000;
      return `${firstPart}-${secondPart}`;
    }
    
    if (platform === 'rusta') {
      return `P${Math.floor(Math.random() * 900000) + 100000}`;
    }
    
    return `PROD-${Math.floor(Math.random() * 90000) + 10000}`;
  };

  // Add to cart via API
  const addToCart = async (productId, quantity, productName) => {
    try {
      const response = await fetch(`${API_URL}/api/add-to-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Success message
        addMessage('bot', `Great! I've added ${quantity} ${productName} to your cart.`);
        
        // Update cart
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
        showErrorModal('Add to Cart Error', errorMsg, data);
      }
    } catch (error) {
      addMessage('bot', 'Sorry, there was an error connecting to the server. Please try again later.');
      showErrorModal('Connection Error', error.message);
    }
  };

  // Update cart
  const updateCart = (productId, productName, quantity) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.productId === productId);
      
      if (existingItemIndex >= 0) {
        // Update quantity
        const newCart = [...prevCart];
        newCart[existingItemIndex].quantity += quantity;
        return newCart;
      } else {
        // Add new item
        return [...prevCart, { productId, productName, quantity }];
      }
    });
  };

  // Show error modal
  const showErrorModal = (title, message, details = null) => {
    setErrorDetails({ title, message, details });
    setShowError(true);
  };

  // Close error modal
  const closeErrorModal = () => {
    setShowError(false);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>E-Commerce Chatbot</title>
        <meta name="description" content="AI-powered chatbot for e-commerce shopping" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <header className={styles.header}>
        <h1>E-Commerce Chatbot</h1>
        <div className={styles.platformSelector}>
          <label htmlFor="platform">Platform:</label>
          <select 
            id="platform" 
            value={platform} 
            onChange={handlePlatformChange}
            className={styles.select}
          >
            <option value="motonet">Motonet</option>
            <option value="rusta">Rusta</option>
          </select>
        </div>
      </header>
      
      <main className={styles.main}>
        <div className={styles.chatContainer}>
          <div className={styles.chatMessages}>
            {messages.map((message, index) => (
              <div key={index} className={`${styles.message} ${styles[message.sender]}`}>
                <div className={styles.messageContent}>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className={styles.userInput}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me to add products to your cart..."
              className={styles.input}
            />
            <button 
              onClick={handleSendMessage}
              className={styles.sendButton}
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
        
        <div className={styles.cartContainer}>
          <h2>Shopping Cart</h2>
          <div className={styles.cartItems}>
            {cart.length === 0 ? (
              <p className={styles.emptyCart}>Your cart is empty</p>
            ) : (
              cart.map((item, index) => (
                <div key={index} className={styles.cartItem}>
                  <div className={styles.cartItemInfo}>
                    <div className={styles.cartItemName}>{item.productName}</div>
                    <div className={styles.cartItemId}>ID: {item.productId}</div>
                  </div>
                  <div className={styles.cartItemQuantity}>Qty: {item.quantity}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      
      <footer className={styles.statusContainer}>
        <div className={styles.statusIndicator}>
          <span className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`}></span>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className={styles.apiStatus}>
          {statusMessage}
        </div>
      </footer>
      
      {showError && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <span className={styles.closeButton} onClick={closeErrorModal}>&times;</span>
            <h2>{errorDetails.title || 'Error'}</h2>
            <p>{errorDetails.message}</p>
            {errorDetails.details && (
              <div className={styles.errorDetails}>
                <pre>{JSON.stringify(errorDetails.details, null, 2)}</pre>
              </div>
            )}
            <button onClick={closeErrorModal} className={styles.dismissButton}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
