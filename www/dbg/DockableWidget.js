class DockableWidget {
  constructor(element, options = {}) {
    this.element = element instanceof HTMLElement ? element : document.querySelector(element);

    if (!this.element) {
      throw new Error('Widget element not found');
    }

    this.options = {
      containerId: options.containerId || null,
      floatingClass: options.floatingClass || 'dockable-floating',
      dockedClass: options.dockedClass || 'dockable-docked',
      dragHandle: options.dragHandle || null,
      onDock: options.onDock || null,
      onUndock: options.onUndock || null,
      savePosition: options.savePosition !== false,
      storageKey: options.storageKey || `dockable-${this.element.id || 'widget'}`,
      snapBackDelay: options.snapBackDelay !== undefined ? options.snapBackDelay : 500,
      snapBackClass: options.snapBackClass || 'dockable-snapback-ready',
      ...options
    };

    this.isDocked = true;
    this.container = null;
    this.originalParent = this.element.parentElement;
    this.originalPosition = {
      x: 0,
      y: 0
    };
    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    };
    this.snapBackState = {
      isOverContainer: false,
      snapBackReady: false,
      hoverTimer: null
    };

    this.init();
  }

  init() {
    if (this.options.containerId) {
      this.container = document.getElementById(this.options.containerId);
    }

    this.element.classList.add(this.options.dockedClass);

    if (this.options.dragHandle) {
      this.setupDragHandle();
    }

    if (this.options.savePosition) {
      this.restoreState();
    }
  }

  setupDragHandle() {
    const handle = this.element.querySelector(this.options.dragHandle);
    if (!handle) return;

    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', this.handleDragStart.bind(this));
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
  }

  handleDragStart(e) {
    if (!this.isDocked) {
      this.dragState.isDragging = true;
      this.dragState.startX = e.clientX - this.dragState.offsetX;
      this.dragState.startY = e.clientY - this.dragState.offsetY;
      this.element.style.cursor = 'move';
    }
  }

  handleDragMove(e) {
    if (!this.dragState.isDragging) return;

    e.preventDefault();
    this.dragState.offsetX = e.clientX - this.dragState.startX;
    this.dragState.offsetY = e.clientY - this.dragState.startY;

    this.element.style.left = `${this.dragState.offsetX}px`;
    this.element.style.top = `${this.dragState.offsetY}px`;

    this.checkSnapBack(e.clientX, e.clientY);
  }

  handleDragEnd(e) {
    if (this.dragState.isDragging) {
      this.dragState.isDragging = false;
      this.element.style.cursor = '';

      if (this.snapBackState.snapBackReady && this.snapBackState.isOverContainer) {
        this.dock();
      } else if (this.options.savePosition) {
        this.saveState();
      }

      this.clearSnapBackState();
    }
  }

  dock(targetContainer = null) {
    if (this.isDocked) return;

    const container = targetContainer || this.container || this.originalParent;

    if (!container) {
      console.warn('No container available for docking');
      return;
    }

    this.element.classList.remove(this.options.floatingClass);
    this.element.classList.add(this.options.dockedClass);

    this.element.style.position = '';
    this.element.style.left = '';
    this.element.style.top = '';
    this.element.style.zIndex = '';

    container.appendChild(this.element);
    this.isDocked = true;

    if (typeof this.options.onDock === 'function') {
      this.options.onDock(this);
    }

    if (this.options.savePosition) {
      this.saveState();
    }
  }

  undock(position = null) {
    if (!this.isDocked) return;

    // Capture position BEFORE moving the element
    const rect = this.element.getBoundingClientRect();

    this.element.classList.remove(this.options.dockedClass);
    this.element.classList.add(this.options.floatingClass);

    this.element.style.position = 'fixed';
    this.element.style.zIndex = '1000';

    if (position) {
      this.element.style.left = `${position.x}px`;
      this.element.style.top = `${position.y}px`;
      this.dragState.offsetX = position.x;
      this.dragState.offsetY = position.y;
    } else {
      this.element.style.left = `${rect.left}px`;
      this.element.style.top = `${rect.top}px`;
      this.dragState.offsetX = rect.left;
      this.dragState.offsetY = rect.top;
    }

    document.body.appendChild(this.element);

    this.isDocked = false;

    if (typeof this.options.onUndock === 'function') {
      this.options.onUndock(this);
    }

    if (this.options.savePosition) {
      this.saveState();
    }
  }

  toggle() {
    if (this.isDocked) {
      this.undock();
    } else {
      this.dock();
    }
  }

  setContainer(containerId) {
    this.container = document.getElementById(containerId);
    if (this.isDocked && this.container) {
      this.dock(this.container);
    }
  }

  getState() {
    return {
      isDocked: this.isDocked,
      position: {
        x: this.dragState.offsetX,
        y: this.dragState.offsetY
      }
    };
  }

  saveState() {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(this.getState()));
    } catch (e) {
      console.warn('Failed to save widget state:', e);
    }
  }

  restoreState() {
    if (typeof localStorage === 'undefined') return;

    try {
      const savedState = localStorage.getItem(this.options.storageKey);
      if (savedState) {
        const state = JSON.parse(savedState);

        if (state.isDocked) {
          this.dock();
        } else {
          this.undock(state.position);
        }
      }
    } catch (e) {
      console.warn('Failed to restore widget state:', e);
    }
  }

  clearSavedState() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.options.storageKey);
  }

  checkSnapBack(mouseX, mouseY) {
    if (!this.container || this.options.snapBackDelay === null) return;

    const containerRect = this.container.getBoundingClientRect();
    const isOver = (
      mouseX >= containerRect.left &&
      mouseX <= containerRect.right &&
      mouseY >= containerRect.top &&
      mouseY <= containerRect.bottom
    );

    if (isOver && !this.snapBackState.isOverContainer) {
      this.snapBackState.isOverContainer = true;
      this.snapBackState.hoverTimer = setTimeout(() => {
        this.snapBackState.snapBackReady = true;
        this.element.classList.add(this.options.snapBackClass);
        if (this.container) {
          this.container.classList.add(this.options.snapBackClass);
        }
      }, this.options.snapBackDelay);
    } else if (!isOver && this.snapBackState.isOverContainer) {
      this.clearSnapBackState();
    }
  }

  clearSnapBackState() {
    if (this.snapBackState.hoverTimer) {
      clearTimeout(this.snapBackState.hoverTimer);
      this.snapBackState.hoverTimer = null;
    }

    this.element.classList.remove(this.options.snapBackClass);
    if (this.container) {
      this.container.classList.remove(this.options.snapBackClass);
    }

    this.snapBackState.isOverContainer = false;
    this.snapBackState.snapBackReady = false;
  }

  destroy() {
    this.clearSnapBackState();

    if (this.options.dragHandle) {
      const handle = this.element.querySelector(this.options.dragHandle);
      if (handle) {
        handle.removeEventListener('mousedown', this.handleDragStart.bind(this));
      }
      document.removeEventListener('mousemove', this.handleDragMove.bind(this));
      document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
    }

    this.element.classList.remove(this.options.floatingClass, this.options.dockedClass);
    this.element.style.position = '';
    this.element.style.left = '';
    this.element.style.top = '';
    this.element.style.zIndex = '';
  }
}

export default DockableWidget;
