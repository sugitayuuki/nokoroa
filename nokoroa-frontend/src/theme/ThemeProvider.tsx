'use client';

import { createTheme, ThemeProvider, useMediaQuery } from '@mui/material';
import { useMemo } from 'react';

interface CustomThemeProviderProps {
  children: React.ReactNode;
}

export default function CustomThemeProvider({
  children,
}: CustomThemeProviderProps) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
          primary: {
            main: '#1976d2',
            light: '#42a5f5',
            dark: '#1565c0',
          },
          secondary: {
            main: '#9c27b0',
            light: '#ba68c8',
            dark: '#7b1fa2',
          },
          background: {
            default: prefersDarkMode ? '#0a0a0a' : '#ffffff',
            paper: prefersDarkMode ? '#1a1a1a' : '#ffffff',
          },
          text: {
            primary: prefersDarkMode ? '#ffffff' : '#171717',
            secondary: prefersDarkMode ? '#b3b3b3' : '#757575',
          },
        },
        typography: {
          fontFamily:
            '"Inter", "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          h1: {
            fontSize: '2.5rem',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.01562em',
          },
          h2: {
            fontSize: '2rem',
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: '-0.00833em',
          },
          h3: {
            fontSize: '1.75rem',
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '0em',
          },
          h4: {
            fontSize: '1.5rem',
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '0.00735em',
          },
          h5: {
            fontSize: '1.25rem',
            fontWeight: 500,
            lineHeight: 1.5,
            letterSpacing: '0em',
          },
          h6: {
            fontSize: '1.125rem',
            fontWeight: 500,
            lineHeight: 1.6,
            letterSpacing: '0.0075em',
          },
          body1: {
            fontSize: '1rem',
            lineHeight: 1.7,
            letterSpacing: '0.00938em',
          },
          body2: {
            fontSize: '0.875rem',
            lineHeight: 1.6,
            letterSpacing: '0.01071em',
          },
          button: {
            textTransform: 'none',
            fontWeight: 500,
            letterSpacing: '0.02857em',
          },
        },
        shape: {
          borderRadius: 12,
        },
        spacing: 8,
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                padding: '10px 20px',
                fontWeight: 500,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                },
              },
              contained: {
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                '&:hover': {
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                fontWeight: 500,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: prefersDarkMode ? '#666' : '#999',
                    },
                  },
                  '&.Mui-focused': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: 2,
                    },
                  },
                },
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: prefersDarkMode ? '#1a1a1a' : '#ffffff',
                borderColor: prefersDarkMode ? '#333333' : '#e0e0e0',
                borderRadius: 0,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: prefersDarkMode ? '#1a1a1a' : '#ffffff',
                borderBottomColor: prefersDarkMode ? '#333333' : '#e0e0e0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                margin: '2px 8px',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: prefersDarkMode ? '#2a2a2a' : '#f8f8f8',
                },
                '&.Mui-selected': {
                  backgroundColor: prefersDarkMode ? '#2a2a2a' : '#f0f0f0',
                  '&:hover': {
                    backgroundColor: prefersDarkMode ? '#333333' : '#e8e8e8',
                  },
                },
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              },
            },
          },
          MuiAvatar: {
            styleOverrides: {
              root: {
                border: `2px solid ${prefersDarkMode ? '#2a2a2a' : '#f0f0f0'}`,
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                borderRadius: 6,
                fontSize: '0.75rem',
                padding: '6px 12px',
              },
            },
          },
        },
      }),
    [prefersDarkMode],
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
