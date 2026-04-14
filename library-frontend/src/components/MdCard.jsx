import React from 'react';

const MdCard = ({ children, variant = 'elevated', className = '' }) => {
    // MD3 三种主要的卡片样式
    const styles = {
        elevated: {
            backgroundColor: 'var(--md-sys-color-surface-container-low, #f7f2fa)',
            boxShadow: 'var(--md-sys-elevation-level1, 0px 1px 3px 1px rgba(0,0,0,0.15))',
        },
        outlined: {
            border: '1px solid var(--md-sys-color-outline-variant, #cac4d0)',
            backgroundColor: 'var(--md-sys-color-surface, #fef7ff)',
        },
        filled: {
            backgroundColor: 'var(--md-sys-color-surface-container-highest, #e6e0e9)',
        }
    };

    const baseStyle = {
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...styles[variant]
    };

    return (
        <div style={baseStyle} className={className}>
            {children}
        </div>
    );
};

export default MdCard;