import {
    createApp,
    defineComponent,
    h,
    reactive,
    ref,
    App,
    VNode,
    onMounted,
    onBeforeUnmount,
    PropType,
    ComponentPublicInstance
} from 'vue'

import './style.scss'

// Utility functions for positioning
interface Position {
    x: number
    y: number
}

interface Size {
    width: number
    height: number
}

interface Viewport {
    width: number
    height: number
}

// Calculate position for a menu to ensure it stays within viewport
function calculateMenuPosition(
    triggerPosition: Position,
    menuSize: Size,
    viewport: Viewport,
    placement: 'bottom-start' | 'top-start' | 'right-start' | 'left-start' = 'bottom-start',
    offset: Position = { x: 0, y: 2 }
): Position {
    let x = triggerPosition.x + offset.x
    let y = triggerPosition.y + offset.y

    // Adjust based on initial placement
    switch (placement) {
        case 'top-start':
            y = triggerPosition.y - menuSize.height - offset.y
            break
        case 'right-start':
            x = triggerPosition.x + offset.x
            y = triggerPosition.y
            break
        case 'left-start':
            x = triggerPosition.x - menuSize.width - offset.x
            y = triggerPosition.y
            break
        case 'bottom-start':
        default:
            y = triggerPosition.y + offset.y
            break
    }

    // Ensure menu stays within viewport horizontally
    if (x + menuSize.width > viewport.width) {
        // If right edge is outside viewport, try to position from right side
        if (placement === 'right-start') {
            // For right placement, try left placement instead
            x = triggerPosition.x - menuSize.width - offset.x
        } else {
            // For other placements, align right edge with viewport
            x = viewport.width - menuSize.width - 8 // 8px padding
        }
    }

    // Ensure menu stays within viewport from left
    if (x < 8) {
        // If left edge is outside viewport, ensure minimum 8px from left
        x = 8
    }

    // Ensure menu stays within viewport vertically
    if (y + menuSize.height > viewport.height) {
        // If bottom edge is outside viewport, try to position from top
        if (placement === 'bottom-start') {
            // For bottom placement, try top placement instead
            y = triggerPosition.y - menuSize.height - offset.y
        } else {
            // For other placements, align bottom edge with viewport
            y = viewport.height - menuSize.height - 8 // 8px padding
        }
    }

    // Ensure menu stays within viewport from top
    if (y < 8) {
        // If top edge is outside viewport, ensure minimum 8px from top
        y = 8
    }

    return { x, y }
}

// Get current viewport size
function getViewport(): Viewport {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    }
}

// Get element size
function getElementSize(element: HTMLElement): Size {
    return {
        width: element.offsetWidth,
        height: element.offsetHeight
    }
}

// Define the menu item interface
export interface ContextMenuItem {
    label?: string
    icon?: string
    action?: () => void
    submenu?: ContextMenuItem[]
    disabled?: boolean
    shortcut?: string
    divider?: boolean
}

// Global state for the context menu
const state = reactive({
    x: 0,
    y: 0,
    items: [] as ContextMenuItem[],
    zIndex: 1000,
    customClass: '',
    menuElement: null as HTMLElement | null,
    triggerElement: null as HTMLElement | null,
    activeSubmenus: new Set<number>()
})

// Create a wrapper div for the context menu
let wrapper: HTMLElement | null = null
let contextMenuApp: App | null = null

// Add this new component before ContextMenuComponent
const SubmenuComponent = defineComponent({
    name: 'SubmenuComponent',
    props: {
        items: {
            type: Array as () => ContextMenuItem[],
            required: true
        },
        parentRef: {
            type: Object as () => HTMLElement,
            required: false,
            default: null
        },
        onMouseEnter: {
            type: [Function, null] as PropType<((index?: number) => void) | null>,
            required: false,
            default: null
        },
        onMouseLeave: {
            type: [Function, null] as PropType<((index?: number) => void) | null>,
            required: false,
            default: null
        }
    },
    setup(props, { emit }) {
        const submenuRef = ref<HTMLElement | null>(null)
        const isPositioned = ref(false)

        // Add state for nested submenus
        const activeSubmenuIndex = ref<number | null>(null)
        const submenuTimers = new Map<number, number>()
        const itemRefs = ref<Map<number, HTMLElement>>(new Map())

        // Position the submenu
        const positionSubmenu = () => {
            if (!submenuRef.value || !props.parentRef) return

            const submenu = submenuRef.value
            const parentRect = props.parentRef.getBoundingClientRect()
            const submenuSize = getElementSize(submenu)
            const viewport = getViewport()
            const PADDING = 8

            // 1. Horizontal positioning - always try right first
            let x = parentRect.right + 1
            if (x + submenuSize.width + PADDING > viewport.width) {
                // If doesn't fit on right, position to the left of parent
                x = parentRect.left - submenuSize.width - 1
            }

            // 2. Vertical positioning
            // First, ensure submenu will fit in viewport height
            let y

            if (submenuSize.height >= viewport.height - 2 * PADDING) {
                // If submenu is taller than viewport, align with top padding
                y = PADDING
            } else {
                // Try to align with parent first
                y = parentRect.top

                // Check if submenu extends below viewport
                if (y + submenuSize.height > viewport.height - PADDING) {
                    // Move submenu up so it fits within viewport
                    y = viewport.height - submenuSize.height - PADDING
                }

                // Ensure it doesn't go above viewport
                if (y < PADDING) {
                    y = PADDING
                }
            }

            // Apply position
            submenu.style.position = 'fixed'
            submenu.style.left = `${x}px`
            submenu.style.top = `${y}px`
        }

        onMounted(() => {
            // Position the submenu after it's mounted
            if (submenuRef.value && props.parentRef) {
                // Position the submenu immediately
                positionSubmenu()
            }
        })

        onBeforeUnmount(() => {
            // Clear any timers
            submenuTimers.forEach((timer) => clearTimeout(timer))
        })

        // Add methods for handling nested submenus
        const clearSubmenuTimer = (index: number) => {
            if (submenuTimers.has(index)) {
                clearTimeout(submenuTimers.get(index))
                submenuTimers.delete(index)
            }
        }

        // Track if mouse is over a submenu
        const isMouseOverSubmenu = ref(false)

        const handleItemClick = (item: ContextMenuItem) => {
            if (item.disabled) return

            // Either emit the event OR execute the action, not both
            if (item.action) {
                item.action()
            } else {
                emit('itemClick', item)
            }

            // Always close the context menu when clicking on an item
            hideContextMenu()
        }


        const handleMouseEnter = (index: number) => {
            clearSubmenuTimer(index)
            if (props.items[index].submenu && !props.items[index].disabled) {
                // Only update if it's different to avoid unnecessary reactivity
                if (activeSubmenuIndex.value !== index) {
                    activeSubmenuIndex.value = index
                }
            }
        }

        // Function to set item ref
        const setItemRef = (el: Element | ComponentPublicInstance | null, index: number) => {
            if (el instanceof HTMLElement) {
                itemRefs.value.set(index, el)
            } else if (el && '$el' in el) {
                const domElement = el.$el
                if (domElement instanceof HTMLElement) {
                    itemRefs.value.set(index, domElement)
                }
            }
        }

        // Add handlers for the submenu container
        const handleSubmenuMouseEnter = () => {
            isMouseOverSubmenu.value = true
            // Call parent callback if provided
            if (props.onMouseEnter) {
                props.onMouseEnter()
            }
        }

        const handleSubmenuMouseLeave = () => {
            isMouseOverSubmenu.value = false
            // Call parent callback if provided
            if (props.onMouseLeave) {
                props.onMouseLeave()
            }
        }

        // Handler for when a nested submenu item is hovered
        const handleNestedItemMouseEnter = (index: number) => {
            // First handle the local item hover
            handleMouseEnter(index)
            // Then propagate up to parent
            if (props.onMouseEnter) {
                props.onMouseEnter()
            }
        }

        // Update handleMouseLeave to check if mouse is over submenu
        const handleMouseLeave = (index: number) => {
            if (props.items[index].submenu) {
                submenuTimers.set(
                    index,
                    window.setTimeout(() => {
                        // Only close the submenu if the mouse is not over it
                        if (activeSubmenuIndex.value === index && !isMouseOverSubmenu.value) {
                            activeSubmenuIndex.value = null
                        }
                    }, 300)
                )
            }
        }

        return {
            submenuRef,
            activeSubmenuIndex,
            itemRefs,
            handleItemClick,
            handleMouseEnter,
            handleMouseLeave,
            setItemRef,
            handleSubmenuMouseEnter,
            handleSubmenuMouseLeave,
            handleNestedItemMouseEnter,
            isMouseOverSubmenu,
            isPositioned,
            positionSubmenu
        }
    },
    render() {
        // Implement our own renderMenuItem function for nested submenus
        const renderMenuItem = (item: ContextMenuItem, index: number): VNode => {
            if (item.divider) {
                return h('div', { class: 'context-menu-divider' })
            }

            const itemClass = [
                'context-menu-item',
                { 'context-menu-item-disabled': item.disabled },
                { 'context-menu-item-with-submenu': item.submenu }
            ]

            const children = [
                item.icon ? h('span', { class: ['item-icon', item.icon] }) : null,
                h('span', { class: 'item-label' }, item.label),
                item.shortcut ? h('span', { class: 'item-shortcut' }, item.shortcut) : null,
                item.submenu ? h('span', { class: 'submenu-arrow' }, '▶') : null
            ]

            // Always render submenu for items with submenu property, but keep it hidden unless active
            if (item.submenu && this.itemRefs.get(index)) {
                const parentRef = this.itemRefs.get(index)
                if (parentRef) {
                    children.push(
                        h(SubmenuComponent, {
                            items: item.submenu,
                            parentRef: parentRef,
                            onMouseEnter: this.handleSubmenuMouseEnter,
                            onMouseLeave: this.handleSubmenuMouseLeave,
                            style: {
                                display: this.activeSubmenuIndex === index ? 'block' : 'none'
                            }
                        })
                    )
                }
            }

            // Use different mouse enter handler based on whether item has submenu
            const mouseEnterHandler = item.submenu
                ? () => {
                      // Immediately set activeSubmenuIndex to prevent flickering
                      if (this.activeSubmenuIndex !== index) {
                          this.activeSubmenuIndex = index
                      }
                      this.handleNestedItemMouseEnter(index)
                  }
                : () => this.handleMouseEnter(index)

            return h(
                'div',
                {
                    ref: (el) => this.setItemRef(el, index),
                    class: itemClass,
                    onClick: () => this.handleItemClick(item),
                    onMouseenter: mouseEnterHandler,
                    onMouseleave: () => this.handleMouseLeave(index)
                },
                children
            )
        }

        return h(
            'div',
            {
                ref: 'submenuRef',
                class: ['context-menu', 'is-submenu'],
                onContextmenu: (e: Event) => e.preventDefault(),
                onMouseenter: this.handleSubmenuMouseEnter,
                onMouseleave: this.handleSubmenuMouseLeave
            },
            h(
                'div',
                { class: 'context-menu-items' },
                this.items.map((item, index) => renderMenuItem(item, index))
            )
        )
    }
})

// Create the context menu component
const ContextMenuComponent = defineComponent({
    name: 'ContextMenuComponent',
    props: {
        items: {
            type: Array as () => ContextMenuItem[],
            required: true
        },
        customClass: {
            type: String,
            default: ''
        }
    },
    emits: ['itemClick'],
    setup(props, { emit }) {
        const activeSubmenuIndex = ref<number | null>(null)
        // Define submenuTimers at the component level
        const submenuTimers = new Map<number, number>()
        // Store refs to menu items for submenu positioning
        const itemRefs = ref<Map<number, HTMLElement>>(new Map())
        // Track if mouse is over a submenu
        const isMouseOverSubmenu = ref(false)

        onBeforeUnmount(() => {
            submenuTimers.forEach((timer) => window.clearTimeout(timer))
            submenuTimers.clear()
        })

        const clearSubmenuTimer = (index: number) => {
            if (submenuTimers.has(index)) {
                clearTimeout(submenuTimers.get(index))
                submenuTimers.delete(index)
            }
        }

        const handleItemClick = (item: ContextMenuItem) => {
            if (item.disabled) return

            // Always emit the itemClick event
            emit('itemClick', item)

            // Execute the action if it exists
            if (item.action) {
                item.action()
            }

            // Always close the context menu when clicking on an item
            hideContextMenu()
        }

        const handleMouseEnter = (index: number) => {
            clearSubmenuTimer(index)
            if (props.items[index].submenu && !props.items[index].disabled) {
                // Only update if it's different to avoid unnecessary reactivity
                if (activeSubmenuIndex.value !== index) {
                    activeSubmenuIndex.value = index
                }
            }
        }

        // Function to set item ref
        const setItemRef = (el: Element | ComponentPublicInstance | null, index: number) => {
            if (el instanceof HTMLElement) {
                itemRefs.value.set(index, el)
            } else if (el && '$el' in el && el.$el instanceof HTMLElement) {
                itemRefs.value.set(index, el.$el)
            }
        }

        // Add handlers for the submenu container
        const handleSubmenuMouseEnter = () => {
            isMouseOverSubmenu.value = true
        }

        const handleSubmenuMouseLeave = () => {
            isMouseOverSubmenu.value = false
        }

        // Handler for when a nested submenu item is hovered
        const handleNestedItemMouseEnter = (index: number) => {
            // First handle the local item hover
            handleMouseEnter(index)
            // No need to propagate up since this is the top-level menu
        }

        const handleMouseLeave = (index: number) => {
            if (props.items[index].submenu) {
                const timerId = setTimeout(() => {
                    // Only close the submenu if the mouse is not over it
                    if (activeSubmenuIndex.value === index && !isMouseOverSubmenu.value) {
                        activeSubmenuIndex.value = null
                    }
                }, 300) as unknown as number

                submenuTimers.set(index, timerId)
            }
        }

        return {
            activeSubmenuIndex,
            itemRefs,
            handleItemClick,
            handleMouseEnter,
            handleMouseLeave,
            setItemRef,
            handleSubmenuMouseEnter,
            handleSubmenuMouseLeave,
            handleNestedItemMouseEnter,
            isMouseOverSubmenu
        }
    },
    render() {
        const renderMenuItem = (item: ContextMenuItem, index: number): VNode => {
            if (item.divider) {
                return h('div', { class: 'context-menu-divider' })
            }

            const itemClass = [
                'context-menu-item',
                { 'context-menu-item-disabled': item.disabled },
                { 'context-menu-item-with-submenu': item.submenu }
            ]

            const children = [
                item.icon ? h('span', { class: ['item-icon', item.icon] }) : null,
                h('span', { class: 'item-label' }, item.label),
                item.shortcut ? h('span', { class: 'item-shortcut' }, item.shortcut) : null,
                item.submenu ? h('span', { class: 'submenu-arrow' }, '▶') : null
            ]

            // Only render submenu if this item is active
            if (item.submenu && this.itemRefs.get(index) && this.activeSubmenuIndex === index) {
                const parentRef = this.itemRefs.get(index)
                if (parentRef) {
                    children.push(
                        h(SubmenuComponent, {
                            items: item.submenu,
                            parentRef: parentRef,
                            onMouseEnter: this.handleSubmenuMouseEnter,
                            onMouseLeave: this.handleSubmenuMouseLeave
                        })
                    )
                }
            }

            // Use different mouse enter handler based on whether item has submenu
            const mouseEnterHandler = item.submenu
                ? () => {
                      if (this.activeSubmenuIndex !== index) {
                          this.activeSubmenuIndex = index
                      }
                      this.handleNestedItemMouseEnter(index)
                  }
                : () => this.handleMouseEnter(index)

            return h(
                'div',
                {
                    ref: (el) => this.setItemRef(el, index),
                    class: itemClass,
                    onClick: () => this.handleItemClick(item),
                    onMouseenter: mouseEnterHandler,
                    onMouseleave: () => this.handleMouseLeave(index)
                },
                children
            )
        }

        return h(
            'div',
            {
                class: ['context-menu', this.customClass],
                onContextmenu: (e: Event) => e.preventDefault(),
                onMouseenter: this.handleSubmenuMouseEnter,
                onMouseleave: this.handleSubmenuMouseLeave
            },
            h(
                'div',
                { class: 'context-menu-items' },
                this.items.map((item, index) => renderMenuItem(item, index))
            )
        )
    }
})

// Function to add click event listeners to iframes
function addIframeListeners() {
    // Get all iframes in the document
    const iframes = document.querySelectorAll('iframe')

    // Add click event listener to each iframe
    iframes.forEach((iframe) => {
        try {
            // Try to access the iframe's contentWindow
            if (iframe.contentWindow && iframe.contentWindow.document) {
                iframe.contentWindow.document.addEventListener('click', () => {
                    hideContextMenu()
                })
            }
        } catch (e) {
            // Ignore cross-origin errors
            console.warn('Could not add event listener to iframe', e)
        }
    })
}

// Function to observe DOM changes and add listeners to new iframes
function setupIframeObserver() {
    // Create a MutationObserver to watch for new iframes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Check if any new iframes were added
                const newIframes = Array.from(mutation.addedNodes).filter(
                    (node) => node.nodeName === 'IFRAME'
                )

                if (newIframes.length > 0) {
                    // Add listeners to new iframes
                    addIframeListeners()
                }
            }
        })
    })

    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true })

    return observer
}

function initContextMenu() {
    if (wrapper) return

    wrapper = document.createElement('div')
    wrapper.id = 'context-menu-wrapper'
    document.body.appendChild(wrapper)

    contextMenuApp = createApp(ContextMenuComponent, {
        items: state.items,
        customClass: state.customClass,
        // onItemClick: (item: ContextMenuItem) => {
        //     if (item.action) {
        //         item.action()
        //     }
        // }
    })

    contextMenuApp.mount(wrapper)
    state.menuElement = wrapper.firstElementChild as HTMLElement

    // Add global document click listener to close menus
    document.addEventListener('click', handleClickOutside)

    // Add listeners to existing iframes
    addIframeListeners()

    // Setup observer for new iframes
    setupIframeObserver()
}

function showContextMenu(options: {
    x: number
    y: number
    items: ContextMenuItem[]
    customClass?: string
    zIndex?: number
}) {
    hideContextMenu()

    if (!wrapper) {
        initContextMenu()
    }

    state.x = options.x
    state.y = options.y
    state.items = options.items
    state.customClass = options.customClass || ''
    state.zIndex = options.zIndex || 1000

    // Create a trigger position object
    const triggerPosition: Position = { x: options.x, y: options.y }
    state.triggerElement = null

    if (contextMenuApp) {
        contextMenuApp.unmount()
    }

    contextMenuApp = createApp(ContextMenuComponent, {
        items: state.items,
        customClass: state.customClass,
        // onItemClick: (item: ContextMenuItem) => {
        //     if (item.action) {
        //         item.action()
        //     }
        // }
    })

    contextMenuApp.mount(wrapper!)
    state.menuElement = wrapper!.firstElementChild as HTMLElement

    if (state.menuElement) {
        state.menuElement.style.zIndex = `${state.zIndex}`

        // Position the menu immediately
        if (state.menuElement) {
            // Get menu size and viewport
            const menuSize = getElementSize(state.menuElement)
            const viewport = getViewport()

            // Calculate position
            const position = calculateMenuPosition(
                triggerPosition,
                menuSize,
                viewport,
                'bottom-start',
                { x: 0, y: 2 }
            )

            // Apply position
            state.menuElement.style.position = 'fixed'
            state.menuElement.style.left = `${position.x}px`
            state.menuElement.style.top = `${position.y}px`
        }

        // Add event listeners for keyboard
        document.addEventListener('keydown', handleKeyDown)

        // Add event listener for context menu with a slight delay to avoid the current event
        setTimeout(() => {
            document.addEventListener('contextmenu', handleClickOutside)
        }, 0)

        // Check for new iframes that might have been added
        addIframeListeners()
    }
}

function hideContextMenu() {
    state.activeSubmenus.clear()
    state.triggerElement = null

    // Only remove the event listeners that are added in showContextMenu
    document.removeEventListener('contextmenu', handleClickOutside)
    document.removeEventListener('keydown', handleKeyDown)

    // We don't remove the click event listener added in initContextMenu
    // as it's a global listener that should persist

    // Remove the context menu from the DOM
    if (contextMenuApp) {
        contextMenuApp.unmount()
        contextMenuApp = null
    }

    if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper)
        wrapper = null
    }
}

function handleClickOutside(e: MouseEvent) {
    // If the context menu doesn't exist, do nothing
    if (!state.menuElement) {
        return
    }

    // Check if the click is outside all menu elements
    // First check if the click is inside the main menu
    if (state.menuElement.contains(e.target as Node)) {
        return // Click is inside the main menu, do nothing
    }

    // Then check if the click is inside any submenu
    const submenus = document.querySelectorAll('.context-menu.is-submenu')
    for (let i = 0; i < submenus.length; i++) {
        if (submenus[i].contains(e.target as Node)) {
            return // Click is inside a submenu, do nothing
        }
    }

    // If we get here, the click is outside all menus
    hideContextMenu()
}

function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        hideContextMenu()
    }
}

function divider(): ContextMenuItem {
    return { divider: true }
}

export const ContextMenu = {
    show(options: {
        x: number
        y: number
        items: ContextMenuItem[]
        customClass?: string
        zIndex?: number
    }) {
        showContextMenu(options)
    },

    hide() {
        hideContextMenu()
    },

    divider
}

export function useContextMenu() {
    const position = ref({ x: 0, y: 0 })
    const menuItems = ref<ContextMenuItem[]>([])

    const showMenu = (x: number, y: number, items: ContextMenuItem[]) => {
        position.value = { x, y }
        menuItems.value = items

        ContextMenu.show({
            x,
            y,
            items
        })
    }

    const onContextMenu = (event: MouseEvent, items: ContextMenuItem[]) => {
        event.preventDefault()
        showMenu(event.clientX, event.clientY, items)
    }

    const closeMenu = () => {
        ContextMenu.hide()
    }

    return {
        position,
        menuItems,
        showMenu,
        onContextMenu,
        closeMenu,
        divider
    }
}

export default {
    install(app: App) {
        app.config.globalProperties.$contextmenu = ContextMenu

        initContextMenu()

        app.unmount = function () {
            if (contextMenuApp) {
                contextMenuApp.unmount()
                contextMenuApp = null
            }

            if (wrapper && wrapper.parentNode) {
                wrapper.parentNode.removeChild(wrapper)
                wrapper = null
            }

            return app
        }
    }
}
