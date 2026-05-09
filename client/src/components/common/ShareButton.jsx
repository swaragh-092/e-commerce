import { useState } from 'react';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const ShareButton = ({ title, text, url, sx = {} }) => {
    const [open, setOpen] = useState(false);
    const [msg, setMsg] = useState('');

    const handleShare = async () => {
        const shareData = {
            title: title || document.title,
            text: text || '',
            url: url || window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error sharing:', err);
                    copyToClipboard(shareData.url);
                }
            }
        } else {
            copyToClipboard(shareData.url);
        }
    };

    const copyToClipboard = async (link) => {
        try {
            await navigator.clipboard.writeText(link);
            setMsg('Link copied to clipboard!');
            setOpen(true);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <>
            <Tooltip title="Share Product" arrow>
                <IconButton 
                    onClick={handleShare}
                    color="primary"
                    sx={{ 
                        '&:hover': {
                            transform: 'scale(1.1)',
                        },
                        transition: 'transform 0.2s ease-in-out',
                        ...sx
                    }}
                    aria-label="share product"
                >
                    <ShareIcon />
                </IconButton>
            </Tooltip>
            
            <Snackbar 
                open={open} 
                autoHideDuration={3000} 
                onClose={() => setOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
                    {msg}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ShareButton;
