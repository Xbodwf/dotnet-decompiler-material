import { createTheme } from '@mui/material/styles';

// Material Design 3 inspired dark theme
export const md3Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d0bcff',
      light: '#e8def8',
      dark: '#9a82db',
      contrastText: '#1d1b20',
    },
    secondary: {
      main: '#ccc2dc',
      light: '#e8def8',
      dark: '#9a82db',
      contrastText: '#1d1b20',
    },
    error: {
      main: '#f2b8b5',
      light: '#f9dedc',
      dark: '#b3261e',
      contrastText: '#1d1b20',
    },
    background: {
      default: '#141218',
      paper: '#1d1b20',
    },
    text: {
      primary: '#e6e0e9',
      secondary: '#cac4d0',
      disabled: '#938f99',
    },
    divider: '#49454f',
  },
  typography: {
    fontFamily: '"Roboto", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 400,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 400,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          textTransform: 'none',
          fontWeight: 500,
          padding: '10px 24px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: '#938f99',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: '#1d1b20',
          border: '1px solid #49454f',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: '#211f26',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&.Mui-selected': {
            backgroundColor: 'rgba(208, 188, 255, 0.12)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '4px 8px',
        },
      },
    },
  },
});

// MD3 color tokens for custom components
export const md3Colors = {
  // Primary
  primary: '#d0bcff',
  onPrimary: '#1d1b20',
  primaryContainer: '#4f378b',
  onPrimaryContainer: '#eaddff',
  
  // Secondary
  secondary: '#ccc2dc',
  onSecondary: '#332d41',
  secondaryContainer: '#4a4458',
  onSecondaryContainer: '#e8def8',
  
  // Tertiary
  tertiary: '#efb8c8',
  onTertiary: '#492532',
  tertiaryContainer: '#633b48',
  onTertiaryContainer: '#ffd8e4',
  
  // Error
  error: '#f2b8b5',
  onError: '#601410',
  errorContainer: '#8c1d18',
  onErrorContainer: '#f9dedc',
  
  // Background
  background: '#141218',
  onBackground: '#e6e0e9',
  
  // Surface
  surface: '#1d1b20',
  onSurface: '#e6e0e9',
  surfaceVariant: '#49454f',
  onSurfaceVariant: '#cac4d0',
  surfaceDim: '#141218',
  surfaceBright: '#3b383e',
  surfaceContainerLowest: '#0f0d13',
  surfaceContainerLow: '#1d1b20',
  surfaceContainer: '#211f26',
  surfaceContainerHigh: '#2b2930',
  surfaceContainerHighest: '#36343b',
  
  // Outline
  outline: '#938f99',
  outlineVariant: '#49454f',
  
  // Text
  textPrimary: '#e6e0e9',
  textSecondary: '#cac4d0',
  textTertiary: '#938f99',
};