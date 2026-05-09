import { useState } from 'react';
import { IconButton, Tooltip, Snackbar, Alert, Menu, SvgIcon, Box, Typography } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import EmailIcon from '@mui/icons-material/Email';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const WhatsAppIcon = (props) => (
    <SvgIcon {...props} viewBox="0 0 24 24">
        <path d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.224 8.224 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.183 8.183 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.4-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23a7.25 7.25 0 0 1-1.38-1.72c-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.17-.25.25-.42.08-.17.05-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01s-.44.06-.66.31c-.23.25-.87.85-.87 2.08 0 1.22.89 2.41 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.28z" />
    </SvgIcon>
);

const PinterestIcon = (props) => (
    <SvgIcon {...props} viewBox="0 0 24 24">
        <path d="M12.01.02C5.39.02.02 5.39.02 12.01c0 5.08 3.14 9.42 7.57 11.17-.1-.95-.2-2.41.04-3.44.22-.93 1.41-5.96 1.41-5.96s-.36-.72-.36-1.78c0-1.67.97-2.91 2.17-2.91 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 3.99-.28 1.19.6 2.16 1.78 2.16 2.13 0 3.77-2.25 3.77-5.49 0-2.87-2.06-4.88-5.01-4.88-3.41 0-5.42 2.56-5.42 5.21 0 1.03.4 2.14.9 2.74.1.12.11.23.07.35-.08.32-.28 1.03-.32 1.17-.05.22-.17.27-.4.16-1.5-.7-2.43-2.89-2.43-4.65 0-3.78 2.75-7.26 7.93-7.26 4.16 0 7.4 2.97 7.4 6.93 0 4.14-2.61 7.46-6.23 7.46-1.22 0-2.36-.64-2.75-1.38l-.75 2.87c-.27 1.04-1 2.35-1.49 3.14 1.12.35 2.31.53 3.55.53 6.62 0 11.99-5.37 11.99-11.99S18.63.02 12.01.02z" />
    </SvgIcon>
);

const PLATFORMS = [
    {
        key: 'whatsapp',
        label: 'WhatsApp',
        icon: WhatsAppIcon,
        color: '#25D366',
        getUrl: ({ title, url }) =>
            `https://wa.me/?text=${encodeURIComponent(title + ' - ' + url)}`,
    },
    {
        key: 'facebook',
        label: 'Facebook',
        icon: FacebookIcon,
        color: '#1877F2',
        getUrl: ({ url }) =>
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
        key: 'twitter',
        label: 'Twitter / X',
        icon: TwitterIcon,
        color: '#000000',
        getUrl: ({ title, url }) =>
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
        key: 'pinterest',
        label: 'Pinterest',
        icon: PinterestIcon,
        color: '#E60023',
        getUrl: ({ title, url, image }) =>
            `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title)}&media=${encodeURIComponent(image || '')}`,
    },
    {
        key: 'email',
        label: 'Email',
        icon: EmailIcon,
        color: '#757575',
        getUrl: ({ title, url }) =>
            `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    },
];

const ShareButton = ({ title, text, url, image, sx = {} }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [snackOpen, setSnackOpen] = useState(false);
    const menusOpen = Boolean(anchorEl);

    const shareUrl = url || window.location.href;
    const shareTitle = title || document.title;
    const shareText = text || '';
    const shareImage = image || '';

    const handleOpen = (event) => {
        if (navigator.share) {
            navigator.share({ title: shareTitle, text: shareText, url: shareUrl }).catch(() => {});
        } else {
            setAnchorEl(event.currentTarget);
        }
    };

    const handleClose = () => setAnchorEl(null);

    const handlePlatformShare = (platform) => {
        if (platform.key === 'copy') {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setSnackOpen(true);
                handleClose();
            }).catch(() => {});
            return;
        }
        const shareLink = platform.getUrl({ title: shareTitle, url: shareUrl, image: shareImage });
        window.open(shareLink, '_blank', 'noopener,noreferrer');
        handleClose();
    };

    return (
        <>
            <Tooltip title="Share Product" arrow>
                <IconButton
                    onClick={handleOpen}
                    color="primary"
                    sx={{
                        '&:hover': { transform: 'scale(1.1)' },
                        transition: 'transform 0.2s ease-in-out',
                        ...sx,
                    }}
                    aria-label="share product"
                >
                    <ShareIcon />
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={menusOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Box sx={{ display: 'flex', gap: 0.5, px: 1, py: 0.5 }}>
                    {PLATFORMS.map((p) => (
                        <Tooltip key={p.key} title={p.label} arrow>
                            <IconButton
                                onClick={() => handlePlatformShare(p)}
                                sx={{
                                    color: p.color,
                                    '&:hover': { bgcolor: p.color + '1a' },
                                }}
                            >
                                <p.icon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    ))}
                    <Tooltip title="Copy Link" arrow>
                        <IconButton
                            onClick={() => handlePlatformShare({ key: 'copy' })}
                            sx={{ color: '#757575', '&:hover': { bgcolor: '#7575751a' } }}
                        >
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Menu>

            <Snackbar
                open={snackOpen}
                autoHideDuration={3000}
                onClose={() => setSnackOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
                    Link copied to clipboard!
                </Alert>
            </Snackbar>
        </>
    );
};

export default ShareButton;
