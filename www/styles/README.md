# Theme System Documentation

## Overview

This application now features a comprehensive theme system that allows you to switch between multiple color schemes with a single click!

## Available Themes

### 🌙 Dark Theme (Default)
Professional dark theme based on VS Code Dark+. Perfect for low-light environments.
- Primary Brand: `#00AEEF` (Cyan)
- Secondary Brand: `#FFD700` (Gold)

### ☀️ Light Theme
Clean, modern light theme for daytime use with excellent readability.
- Primary Brand: `#0095D9` (Saturated Cyan)
- Secondary Brand: `#E6B800` (Saturated Gold)

### 🌰 Cinnamon Theme
Warm, spicy brown tones inspired by Ubuntu's Cinnamon desktop. Cozy and easy on the eyes.
- Primary Brand: `#D97741` (Cinnamon)
- Secondary Brand: `#E0A458` (Golden Brown)

### 🧇 Maple & Waffles Theme
Delicious breakfast-inspired theme with golden waffles and rich maple syrup colors. Perfect for morning coding sessions!
- Primary Brand: `#D4A017` (Golden Waffle)
- Secondary Brand: `#8B4513` (Maple Syrup)

## How to Switch Themes

Click the **🎨 paint palette button** in the top-right corner of the app to open the theme selector. Your choice is automatically saved to localStorage and will persist across sessions.

## Theme System Architecture

### Core Files

```
/www/styles/
├── theme-base.css              # CSS variable definitions (structure only)
├── theme-dark.css              # Dark theme color values
├── theme-light.css             # Light theme color values
├── theme-cinnamon.css          # Cinnamon theme color values
├── theme-maple-waffles.css     # Maple & Waffles theme color values
├── utilities.css               # Utility CSS classes
├── theme-switcher.js           # Theme switching logic
├── theme-switcher.css          # Theme switcher UI styles
└── README.md                   # This file
```

### CSS Variables Reference

All themes define these CSS variables:

#### Brand Colors
- `--brand-primary` - Primary brand color (cyan/blue tones)
- `--brand-secondary` - Secondary brand color (gold tones)
- `--brand-accent` - Accent color for interactive elements

#### Background Colors
- `--color-bg-primary` - Main background
- `--color-bg-secondary` - Secondary background (lighter)
- `--color-bg-tertiary` - Tertiary background (even lighter)
- `--color-bg-elevated` - Elevated elements (modals, popovers)
- `--color-bg-hover` - Hover state background
- `--color-bg-active` - Active/selected state background

#### Text Colors
- `--color-text-primary` - Primary text color
- `--color-text-secondary` - Secondary text (slightly muted)
- `--color-text-muted` - Muted text (labels, placeholders)
- `--color-text-link` - Hyperlinks
- `--color-text-function` - Function/code highlighting
- `--color-text-inverse` - Inverse text (light text on dark bg, vice versa)

#### Border Colors
- `--color-border-default` - Default border color
- `--color-border-subtle` - Subtle borders
- `--color-border-focus` - Focus state borders

#### Status Colors
- `--color-status-success` - Success messages
- `--color-status-warning` - Warning messages
- `--color-status-error` - Error messages
- `--color-status-info` - Info messages
- `--color-status-connected` - Connected state indicator
- `--color-status-disconnected` - Disconnected state indicator
- `--color-status-paused` - Paused state indicator

#### Console Log Levels
- `--color-log-debug` - Debug messages
- `--color-log-info` - Info messages
- `--color-log-warn` - Warning messages
- `--color-log-error` - Error messages
- `--color-log-event` - Event messages

#### Spacing System
- `--space-xs` - Extra small spacing (4px)
- `--space-sm` - Small spacing (8px)
- `--space-md` - Medium spacing (12px)
- `--space-lg` - Large spacing (20px)
- `--space-xl` - Extra large spacing (32px)

#### Typography
- `--font-size-xs` through `--font-size-xl` - Responsive font sizes
- `--font-family-base` - Base font stack
- `--font-family-mono` - Monospace font stack
- `--font-weight-normal`, `--font-weight-medium`, `--font-weight-bold`

#### Layout
- `--header-height` - Header height (responsive)
- `--sidebar-width` - Sidebar width
- `--gutter-size` - Gutter size

#### Animations
- `--transition-fast` - Fast transitions (0.15s)
- `--transition-normal` - Normal transitions (0.2s)
- `--transition-slow` - Slow transitions (0.3s)

#### Border Radius
- `--radius-sm` through `--radius-xl` - Border radius values

#### Shadows
- `--shadow-sm`, `--shadow-md`, `--shadow-lg` - Box shadow values

## Creating a New Theme

1. Create a new CSS file: `/www/styles/theme-mytheme.css`

2. Define all CSS variables with your custom colors:

```css
[data-theme="mytheme"] {
  --brand-primary: #FF6B35;
  --brand-secondary: #F7931E;
  /* ... define all other variables ... */
}
```

3. Add your theme to the theme switcher in `/www/styles/theme-switcher.js`:

```javascript
this.themes = [
    { id: 'dark', name: 'Dark', icon: '🌙' },
    { id: 'light', name: 'Light', icon: '☀️' },
    { id: 'cinnamon', name: 'Cinnamon', icon: '🌰' },
    { id: 'maple-waffles', name: 'Maple & Waffles', icon: '🧇' },
    { id: 'mytheme', name: 'My Theme', icon: '🎨' } // Add your theme here
];
```

4. Import your theme CSS in `/www/app/index.html`:

```html
<link rel="stylesheet" href="/styles/theme-mytheme.css"/>
```

## Rebranding the Application

To rebrand the entire application with new colors, simply:

1. Open any theme file (e.g., `theme-dark.css`)
2. Update the three brand color values:
   ```css
   --brand-primary: #YOUR_PRIMARY_COLOR;
   --brand-secondary: #YOUR_SECONDARY_COLOR;
   --brand-accent: #YOUR_ACCENT_COLOR;
   ```
3. The entire UI will update automatically!

## GWT/Pithagoras Integration

The Pithagoras GWT application wrapper (`/pithagoras/war/pithagoras.css`) has been migrated to use the same CSS variables. This means:

- ✅ Theme changes apply to both the debugger AND the simulator wrapper
- ✅ Brand colors sync automatically across the entire integrated application
- ✅ The CircuitJS1 simulator UI chrome will match your theme

**Note:** The circuit canvas rendering (wires, components, voltages) is drawn in Java and won't automatically theme. To customize those, you'd need to modify the Java source files.

## Migrated Files

All CSS files have been migrated to use CSS variables:

### Node Inspector (Debugger)
- ✅ `/www/debugger/styles.css` (1,316 lines)
- ✅ `/www/console/console.css` (465 lines)
- ✅ `/www/app/styles.css` (998 lines)
- ✅ `/www/breadboard/pin-manager.css` (170 lines)
- ✅ `/www/client/workspace-browser.css` (275 lines)

### Pithagoras (GWT Wrapper)
- ✅ `/pithagoras/war/pithagoras.css` (999 lines)

**Total:** 4,223 lines of CSS normalized and themeable!

## Browser Support

The theme system uses modern CSS features:
- CSS Custom Properties (CSS Variables)
- localStorage API
- Data attributes for theme switching

Supported browsers:
- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

## Best Practices

1. **Always use CSS variables** - Never hardcode colors in new CSS
2. **Use utility classes** - Leverage `/www/styles/utilities.css` for common patterns
3. **Test all themes** - When adding new UI, verify it looks good in all four themes
4. **Semantic naming** - Use semantic variable names (e.g., `--color-status-error`) not descriptive names (e.g., `--color-red`)
5. **Maintain contrast** - Ensure text meets WCAG AA contrast ratios

## Troubleshooting

### Theme not applying?
- Check browser console for CSS loading errors
- Verify theme files are imported in correct order (base → themes → switcher)
- Clear localStorage: `localStorage.removeItem('app-theme')`

### Colors not changing?
- Make sure you're using CSS variables, not hardcoded hex values
- Check that the variable name matches the theme definition
- Inspect element to see computed CSS variable values

### Switcher button not appearing?
- Verify `theme-switcher.js` is loaded after `logger.js`
- Check browser console for JavaScript errors
- Ensure the button isn't hidden behind other elements (z-index issue)

## Future Enhancements

Possible improvements:
- [ ] System theme auto-detection (`prefers-color-scheme`)
- [ ] Theme transition animations
- [ ] Custom theme builder UI
- [ ] Export/import custom themes
- [ ] Per-component theme overrides
- [ ] High contrast mode for accessibility

## Credits

Created with ❤️ by Claude Code
Theme system designed for maximum flexibility and ease of rebranding
