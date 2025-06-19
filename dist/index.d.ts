import { App } from 'vue';
import './style.scss';
export interface ContextMenuItem {
    label?: string;
    icon?: string;
    action?: () => void;
    submenu?: ContextMenuItem[];
    disabled?: boolean;
    shortcut?: string;
    divider?: boolean;
}
declare function divider(): ContextMenuItem;
export declare const ContextMenu: {
    show(options: {
        x: number;
        y: number;
        items: ContextMenuItem[];
        customClass?: string;
        zIndex?: number;
    }): void;
    hide(): void;
    divider: typeof divider;
};
export declare function useContextMenu(): {
    position: import("vue").Ref<{
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    } | {
        x: number;
        y: number;
    }>;
    menuItems: import("vue").Ref<{
        label?: string | undefined;
        icon?: string | undefined;
        action?: (() => void) | undefined;
        submenu?: any[] | undefined;
        disabled?: boolean | undefined;
        shortcut?: string | undefined;
        divider?: boolean | undefined;
    }[], ContextMenuItem[] | {
        label?: string | undefined;
        icon?: string | undefined;
        action?: (() => void) | undefined;
        submenu?: any[] | undefined;
        disabled?: boolean | undefined;
        shortcut?: string | undefined;
        divider?: boolean | undefined;
    }[]>;
    showMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
    onContextMenu: (event: MouseEvent, items: ContextMenuItem[]) => void;
    closeMenu: () => void;
    divider: typeof divider;
};
declare const _default: {
    install(app: App): void;
};
export default _default;
