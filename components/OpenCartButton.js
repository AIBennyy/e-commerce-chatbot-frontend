import React, { useState } from 'react';

const OpenCartButton = ({ platform, cartItems }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const openCart = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!platform) {
        console.error('Platform not specified.');
        setError('Platform not specified');
        setIsLoading(false);
        return;
      }
      
      // Log the API URL being used
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://e-commerce-chatbot-api.herokuapp.com'}/api/cart/url?platform=${platform}`;
      console.log('Fetching cart URL from:', apiUrl);
      
      // Call the backend API endpoint to get the cart URL
      const response = await fetch(apiUrl);
      
      console.log('API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Received cart URL:', data.cartUrl);
        
        // Open the cart URL in a new tab/window
        window.open(data.cartUrl, '_blank');
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch cart URL:', errorText);
        setError(`Failed to fetch cart URL: ${response.status}`);
        
        // Fallback: Open the default cart URL for the platform
        const fallbackUrls = {
          motonet: 'https://www.motonet.fi/fi/ostoskori',
          rusta: 'https://www.rusta.com/fi/cart',
          sryhma: 'https://www.s-kaupat.fi/cart',
          gigantti: 'https://www.gigantti.fi/cart'
        };
        
        if (fallbackUrls[platform]) {
          console.log('Using fallback URL:', fallbackUrls[platform]);
          window.open(fallbackUrls[platform], '_blank');
        }
      }
    } catch (error) {
      console.error('Error fetching cart URL:', error);
      setError(`Error: ${error.message}`);
      
      // Fallback for network errors
      const fallbackUrls = {
        motonet: 'https://www.motonet.fi/fi/ostoskori',
        rusta: 'https://www.rusta.com/fi/cart',
        sryhma: 'https://www.s-kaupat.fi/cart',
        gigantti: 'https://www.gigantti.fi/cart'
      };
      
      if (fallbackUrls[platform]) {
        console.log('Using fallback URL after error:', fallbackUrls[platform]);
        window.open(fallbackUrls[platform], '_blank');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Only display the button if there are items in the cart
  if (!cartItems || cartItems.length === 0) {
    return null;
  }

  return (
    <div>
      <button 
        onClick={openCart} 
        style={{
          ...buttonStyle,
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? 'wait' : 'pointer'
        }}
        disabled={isLoading}
      >
        {isLoading ? 'Opening cart...' : 'Open my cart'}
      </button>
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
};

const buttonStyle = {
  padding: '10px 20px',
  fontSize: '16px',
  backgroundColor: '#0070f3',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  marginTop: '20px'
};

const errorStyle = {
  color: 'red',
  fontSize: '14px',
  marginTop: '5px'
};

export default OpenCartButton;
