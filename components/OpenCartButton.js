import React from 'react';

const OpenCartButton = ({ platform, cartItems }) => {
  const openCart = async () => {
    try {
      if (!platform) {
        console.error('Platform not specified.');
        return;
      }
      // Call the backend API endpoint to get the cart URL
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cart/url?platform=${platform}`
      );
      if (response.ok) {
        const { cartUrl } = await response.json();
        // Open the cart URL in a new tab/window
        window.open(cartUrl, '_blank');
      } else {
        console.error('Failed to fetch cart URL');
      }
    } catch (error) {
      console.error('Error fetching cart URL:', error);
    }
  };

  // Only display the button if there are items in the cart
  if (!cartItems || cartItems.length === 0) {
    return null;
  }

  return (
    <button onClick={openCart} style={buttonStyle}>
      Open my cart
    </button>
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

export default OpenCartButton;
