import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, padding = 'p-5' }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-brand-200' : ''} ${padding} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
