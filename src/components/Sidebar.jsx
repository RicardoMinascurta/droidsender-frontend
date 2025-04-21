import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Send,
  LogOut
} from "lucide-react";

const SidebarItem = ({ icon, label, to, end = false }) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => 
        `flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 cursor-pointer rounded-md ${isActive ? 'bg-gray-100 font-medium' : ''}`
      }
    >
      {icon}
      <span className="ml-3">{label}</span>
    </NavLink>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <div className="w-64 bg-white border-r h-screen flex flex-col">
      <div className="p-4 h-16 flex items-center border-b">
        <h2 className="text-xl font-semibold text-gray-800">DroidSender</h2>
      </div>
      
      <div className="py-4 flex-grow">
        <div className="space-y-1 px-2">
          <SidebarItem 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Dashboard" 
            to="/" 
            end={true}
          />
          
          <SidebarItem 
            icon={<Send className="w-5 h-5" />} 
            label="Campanhas" 
            to="/campaigns"
          />
        </div>
      </div>
      
      <div className="border-t p-4 mt-auto">
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-800 truncate" title={user?.email}>
            {user?.email || 'Carregando...'}
          </p>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 