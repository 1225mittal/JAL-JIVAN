import React from 'react';
import Login from '../pages/Login';

export const AdminLogin = ({ onLoginSuccess }) => {
  return <Login onLoginSuccess={onLoginSuccess} />;
};

export default AdminLogin;

