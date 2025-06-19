# @wuild/vue-contextmenu

A customizable context menu component for Vue 3.

## Installation

```bash
npm install @wuild/vue-contextmenu
# or
yarn add @wuild/vue-contextmenu
```

## Usage

### Global Registration

```js
import { createApp } from 'vue'
import App from './App.vue'
import ContextMenu from '@wuild/vue-contextmenu'
// Import the CSS
import '@wuild/vue-contextmenu/dist/style.css'

const app = createApp(App)
app.use(ContextMenu)
app.mount('#app')
```

Then in your components:

```js
// In your Vue component
export default {
  methods: {
    showContextMenu(event) {
      this.$contextmenu.show({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            label: 'Item 1',
            action: () => console.log('Item 1 clicked')
          },
          {
            label: 'Item 2',
            action: () => console.log('Item 2 clicked')
          },
          this.$contextmenu.divider(),
          {
            label: 'Disabled Item',
            disabled: true
          },
          {
            label: 'Submenu',
            submenu: [
              {
                label: 'Submenu Item 1',
                action: () => console.log('Submenu Item 1 clicked')
              },
              {
                label: 'Submenu Item 2',
                action: () => console.log('Submenu Item 2 clicked')
              }
            ]
          }
        ]
      })
    }
  }
}
```

### Composition API

```js
<script setup>
import { useContextMenu } from '@wuild/vue-contextmenu'

const { onContextMenu, divider } = useContextMenu()

function handleContextMenu(event) {
  onContextMenu(event, [
    {
      label: 'Item 1',
      action: () => console.log('Item 1 clicked')
    },
    {
      label: 'Item 2',
      action: () => console.log('Item 2 clicked')
    },
    divider(),
    {
      label: 'Disabled Item',
      disabled: true
    },
    {
      label: 'Submenu',
      submenu: [
        {
          label: 'Submenu Item 1',
          action: () => console.log('Submenu Item 1 clicked')
        },
        {
          label: 'Submenu Item 2',
          action: () => console.log('Submenu Item 2 clicked')
        }
      ]
    }
  ])
}
</script>

<template>
  <div @contextmenu.prevent="handleContextMenu">
    Right-click me
  </div>
</template>
```

## API

### ContextMenu Object

- `show(options)`: Shows the context menu
  - `options.x`: X position
  - `options.y`: Y position
  - `options.items`: Array of menu items
  - `options.customClass`: Optional custom CSS class
  - `options.zIndex`: Optional z-index value
- `hide()`: Hides the context menu
- `divider()`: Returns a divider item

### Menu Item Properties

- `label`: Text to display
- `icon`: Optional icon class
- `action`: Function to execute when clicked
- `submenu`: Array of submenu items
- `disabled`: Boolean to disable the item
- `shortcut`: Optional shortcut text to display
- `divider`: Boolean to render as a divider

## License

MIT
