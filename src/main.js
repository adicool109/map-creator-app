import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

let map;
let editCanvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'brush';
let drawingHistory = [];
let historyIndex = -1;
let startX, startY;
let currentShape = null;
let textInput = null;
let originalImageData = null;
let lastX = 0;
let lastY = 0;

// Initialize the map
function initMap() {
    map = L.map('map', {
        attributionControl: false
    }).setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        maxZoom: 18,
        subdomains: 'abcd'
    }).addTo(map);

    document.getElementById('captureBtn').disabled = false;
}

function initDrawingTools() {
    // Get canvas reference
    editCanvas = document.getElementById('editCanvas');
    if (!editCanvas) {
        console.error('Edit canvas not found');
        return;
    }
    
    ctx = editCanvas.getContext('2d');
    
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveTool(btn.dataset.tool);
        });
    });

    // Set initial active tool
    setActiveTool('brush');

    // Initialize color picker and presets
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        colorPicker.addEventListener('change', (e) => {
            ctx.strokeStyle = e.target.value;
            ctx.fillStyle = e.target.value;
        });
    }

    // Initialize color presets
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.style.backgroundColor;
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            if (colorPicker) {
                colorPicker.value = rgbToHex(color);
            }
        });
    });

    // Initialize brush size and opacity controls
    const brushSize = document.getElementById('brushSize');
    if (brushSize) {
        brushSize.addEventListener('input', (e) => {
            ctx.lineWidth = e.target.value;
        });
    }

    const brushOpacity = document.getElementById('brushOpacity');
    if (brushOpacity) {
        brushOpacity.addEventListener('input', (e) => {
            ctx.globalAlpha = e.target.value / 100;
        });
    }

    // Undo/Redo
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);

    // Text styling
    document.getElementById('boldText').addEventListener('click', (e) => {
        e.target.classList.toggle('active');
    });
    document.getElementById('italicText').addEventListener('click', (e) => {
        e.target.classList.toggle('active');
    });
}

// Helper function to convert RGB to Hex
function rgbToHex(rgb) {
    // If rgb is already a hex value, return it
    if (rgb.startsWith('#')) return rgb;
    
    // Extract RGB values
    const rgbValues = rgb.match(/\d+/g);
    if (!rgbValues) return '#000000';
    
    const r = parseInt(rgbValues[0]);
    const g = parseInt(rgbValues[1]);
    const b = parseInt(rgbValues[2]);
    
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = editCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineWidth = document.getElementById('brushSize').value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = document.getElementById('colorPicker').value;
    ctx.fillStyle = document.getElementById('colorPicker').value;
    ctx.globalAlpha = document.getElementById('brushOpacity').value / 100;
    
    switch (currentTool) {
        case 'brush':
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;
            
        case 'eraser':
            const currentCompositeOperation = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.globalCompositeOperation = currentCompositeOperation;
            break;
            
        case 'rectangle':
            // Clear previous preview
            if (currentShape) {
                ctx.putImageData(currentShape, 0, 0);
            } else {
                currentShape = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
            }
            ctx.beginPath();
            ctx.rect(startX, startY, x - startX, y - startY);
            ctx.stroke();
            break;
            
        case 'circle':
            // Clear previous preview
            if (currentShape) {
                ctx.putImageData(currentShape, 0, 0);
            } else {
                currentShape = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
            }
            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
        case 'line':
            // Clear previous preview
            if (currentShape) {
                ctx.putImageData(currentShape, 0, 0);
            } else {
                currentShape = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
            }
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;
    }
    
    lastX = x;
    lastY = y;
}

function startDrawing(e) {
    isDrawing = true;
    const rect = editCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    startX = lastX;
    startY = lastY;
    
    if (currentTool === 'text') {
        handleTextTool(e);
        return;
    }
    
    // Store initial state for shape tools
    if (['rectangle', 'circle', 'line'].includes(currentTool)) {
        currentShape = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    }
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Save state for completed shapes
    if (['brush', 'eraser', 'rectangle', 'circle', 'line'].includes(currentTool)) {
        saveState();
    }
    
    currentShape = null;
}

function handleTextTool(e) {
    if (textInput) {
        textInput.remove();
    }
    
    textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.style.position = 'absolute';
    textInput.style.left = (e.clientX) + 'px';
    textInput.style.top = (e.clientY) + 'px';
    textInput.style.zIndex = '1000';
    textInput.style.backgroundColor = 'transparent';
    textInput.style.border = '1px solid #ccc';
    
    document.querySelector('.editor-container').appendChild(textInput);
    textInput.focus();
    
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const fontSize = document.getElementById('fontSize').value;
            const fontFamily = document.getElementById('fontFamily').value;
            
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillStyle = document.getElementById('colorPicker').value;
            ctx.globalAlpha = document.getElementById('brushOpacity').value / 100;
            ctx.fillText(textInput.value, startX, startY);
            
            textInput.remove();
            textInput = null;
            saveState();
        }
    });
}

function setActiveTool(tool) {
    if (!editCanvas) {
        console.error('Canvas not initialized');
        return;
    }
    
    currentTool = tool;
    
    // Update button states
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tool === tool) {
            btn.classList.add('active');
        }
    });
    
    // Update cursor style
    switch (tool) {
        case 'brush':
        case 'eraser':
            editCanvas.style.cursor = 'crosshair';
            break;
        case 'fill':
            editCanvas.style.cursor = 'cell';
            break;
        case 'text':
            editCanvas.style.cursor = 'text';
            break;
        default:
            editCanvas.style.cursor = 'default';
    }
    
    // Show/hide text controls
    const textControls = document.querySelector('.text-controls');
    if (textControls) {
        textControls.style.display = tool === 'text' ? 'block' : 'none';
    }
    
    // Remove text input if switching from text tool
    if (tool !== 'text' && textInput) {
        textInput.remove();
        textInput = null;
    }
}

function floodFill(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    const pixels = imageData.data;
    
    const startPos = (y * editCanvas.width + x) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];
    
    const fillR = parseInt(fillColor.substr(1,2), 16);
    const fillG = parseInt(fillColor.substr(3,2), 16);
    const fillB = parseInt(fillColor.substr(5,2), 16);
    
    function matchesStart(pos) {
        return pixels[pos] === startR &&
               pixels[pos + 1] === startG &&
               pixels[pos + 2] === startB &&
               pixels[pos + 3] === startA;
    }
    
    function colorPixel(pos) {
        pixels[pos] = fillR;
        pixels[pos + 1] = fillG;
        pixels[pos + 2] = fillB;
        pixels[pos + 3] = 255;
    }
    
    const stack = [[x, y]];
    while (stack.length) {
        const [curX, curY] = stack.pop();
        const pos = (curY * editCanvas.width + curX) * 4;
        
        if (curX < 0 || curX >= editCanvas.width || curY < 0 || curY >= editCanvas.height || !matchesStart(pos)) {
            continue;
        }
        
        colorPixel(pos);
        
        stack.push([curX + 1, curY], [curX - 1, curY], [curX, curY + 1], [curX, curY - 1]);
    }
    
    ctx.putImageData(imageData, 0, 0);
    saveState();
}

function saveState() {
    historyIndex++;
    drawingHistory = drawingHistory.slice(0, historyIndex);
    drawingHistory.push(ctx.getImageData(0, 0, editCanvas.width, editCanvas.height));
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        ctx.putImageData(drawingHistory[historyIndex], 0, 0);
        updateUndoRedoButtons();
    }
}

function redo() {
    if (historyIndex < drawingHistory.length - 1) {
        historyIndex++;
        ctx.putImageData(drawingHistory[historyIndex], 0, 0);
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= drawingHistory.length - 1;
}

async function captureMap() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const mapContainer = document.querySelector('.map-container');
    const editorContainer = document.querySelector('.editor-container');
    const mapElement = document.getElementById('map');
    
    if (!loadingIndicator || !mapContainer || !editorContainer || !mapElement) {
        console.error('Required elements not found');
        return;
    }
    
    try {
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Get map dimensions
        const width = mapElement.offsetWidth;
        const height = mapElement.offsetHeight;
        
        // Create temporary canvas for map capture
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Wait a short moment for any ongoing tile loading to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use html2canvas for better map capture
        const mapCanvas = await html2canvas(mapElement, {
            useCORS: true,
            allowTaint: true,
            width: width,
            height: height,
            scrollX: 0,
            scrollY: 0,
            windowWidth: width,
            windowHeight: height,
            logging: false,
            backgroundColor: null,
            scale: window.devicePixelRatio || 1
        });
        
        // Copy the captured map to our temporary canvas
        canvas.getContext('2d').drawImage(mapCanvas, 0, 0);
        
        // Set up edit canvas
        editCanvas = document.getElementById('editCanvas');
        if (!editCanvas) {
            throw new Error('Edit canvas not found');
        }
        
        editCanvas.width = width;
        editCanvas.height = height;
        ctx = editCanvas.getContext('2d');
        
        // Copy captured image to edit canvas
        ctx.drawImage(canvas, 0, 0);
        
        // Store original state
        originalImageData = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
        
        // Initialize drawing tools after canvas is ready
        initDrawingTools();
        initImageControls();
        
        // Add canvas event listeners
        editCanvas.addEventListener('mousedown', startDrawing);
        editCanvas.addEventListener('mousemove', draw);
        editCanvas.addEventListener('mouseup', stopDrawing);
        editCanvas.addEventListener('mouseout', stopDrawing);
        
        // Switch to editor view
        mapContainer.style.display = 'none';
        editorContainer.style.display = 'block';
        
    } catch (error) {
        console.error('Error capturing map:', error);
        alert('Failed to capture map. Please try again.');
    } finally {
        // Always hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Image filter controls
let currentFilters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    filter: 'none'
};

function applyImageFilters() {
    const canvas = document.getElementById('editCanvas');
    if (!canvas || !ctx || !originalImageData) return;

    // Start with the original image data
    ctx.putImageData(originalImageData, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Get original RGB values
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply special filters first
        if (currentFilters.filter !== 'none') {
            switch (currentFilters.filter) {
                case 'grayscale':
                    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                    r = luminance;
                    g = luminance;
                    b = luminance;
                    break;
                case 'sepia':
                    // Store original values before modifying
                    const tr = r, tg = g, tb = b;
                    // Apply sepia transformation
                    r = Math.min(255, (tr * 0.393) + (tg * 0.769) + (tb * 0.189));
                    g = Math.min(255, (tr * 0.349) + (tg * 0.686) + (tb * 0.168));
                    b = Math.min(255, (tr * 0.272) + (tg * 0.534) + (tb * 0.131));
                    break;
                case 'invert':
                    // Invert each channel
                    r = 255 - r;
                    g = 255 - g;
                    b = 255 - b;
                    break;
            }
        }

        // Apply brightness
        const brightness = currentFilters.brightness;
        if (brightness !== 100) {
            const adjustment = (brightness - 100) / 100;
            r += 255 * adjustment;
            g += 255 * adjustment;
            b += 255 * adjustment;
        }

        // Apply contrast
        const contrast = currentFilters.contrast;
        if (contrast !== 100) {
            const adjustment = Math.pow((contrast + 100) / 200, 2);
            r = (r - 128) * adjustment + 128;
            g = (g - 128) * adjustment + 128;
            b = (b - 128) * adjustment + 128;
        }

        // Apply saturation
        const saturation = currentFilters.saturation;
        if (saturation !== 100) {
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            const saturationAdjustment = saturation / 100;
            r = luminance + (r - luminance) * saturationAdjustment;
            g = luminance + (g - luminance) * saturationAdjustment;
            b = luminance + (b - luminance) * saturationAdjustment;
        }

        // Ensure values are within valid range (0-255)
        data[i] = Math.min(255, Math.max(0, Math.round(r)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
    }

    ctx.putImageData(imageData, 0, 0);
    saveState();
}

function resetFilters() {
    currentFilters = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        filter: 'none'
    };

    // Reset UI controls
    const brightnessControl = document.getElementById('brightness');
    const contrastControl = document.getElementById('contrast');
    const saturationControl = document.getElementById('saturation');
    const filterSelect = document.getElementById('imageFilter');

    if (brightnessControl) brightnessControl.value = 0;
    if (contrastControl) contrastControl.value = 0;
    if (saturationControl) saturationControl.value = 0;
    if (filterSelect) filterSelect.value = 'none';

    // Restore original image
    if (originalImageData && ctx) {
        ctx.putImageData(originalImageData, 0, 0);
        saveState();
    }
}

function initImageControls() {
    // Initialize filter select
    const filterSelect = document.getElementById('imageFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilters.filter = e.target.value;
            // Reset other adjustments when applying a filter
            if (e.target.value !== 'none') {
                currentFilters.brightness = 100;
                currentFilters.contrast = 100;
                currentFilters.saturation = 100;
                
                // Reset the range inputs
                const brightnessControl = document.getElementById('brightness');
                const contrastControl = document.getElementById('contrast');
                const saturationControl = document.getElementById('saturation');
                
                if (brightnessControl) brightnessControl.value = 0;
                if (contrastControl) contrastControl.value = 0;
                if (saturationControl) saturationControl.value = 0;
            }
            applyImageFilters();
        });
    }

    // Initialize brightness control
    const brightnessControl = document.getElementById('brightness');
    if (brightnessControl) {
        brightnessControl.addEventListener('input', (e) => {
            currentFilters.brightness = parseInt(e.target.value) + 100;
            applyImageFilters();
        });
    }

    // Initialize contrast control
    const contrastControl = document.getElementById('contrast');
    if (contrastControl) {
        contrastControl.addEventListener('input', (e) => {
            currentFilters.contrast = parseInt(e.target.value) + 100;
            applyImageFilters();
        });
    }

    // Initialize saturation control
    const saturationControl = document.getElementById('saturation');
    if (saturationControl) {
        saturationControl.addEventListener('input', (e) => {
            currentFilters.saturation = parseInt(e.target.value) + 100;
            applyImageFilters();
        });
    }

    // Initialize reset filters button
    const resetButton = document.getElementById('resetFilters');
    if (resetButton) {
        resetButton.addEventListener('click', resetFilters);
    }
}

function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key.toLowerCase()) {
        case 'b':
            setActiveTool('brush');
            break;
        case 'e':
            setActiveTool('eraser');
            break;
        case 'r':
            setActiveTool('rectangle');
            break;
        case 'c':
            setActiveTool('circle');
            break;
        case 'l':
            setActiveTool('line');
            break;
        case 't':
            setActiveTool('text');
            break;
        case 'f':
            setActiveTool('fill');
            break;
    }
}

// Initialize map when page loads
window.onload = function() {
    initMap();
    
    // Initialize capture button and back button
    document.getElementById('captureBtn').addEventListener('click', captureMap);
    document.getElementById('backBtn').addEventListener('click', () => {
        document.querySelector('.editor-container').style.display = 'none';
        document.querySelector('.map-container').style.display = 'block';
    });
    
    // Initialize keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    document.getElementById('downloadBtn').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'map.png';
        link.href = editCanvas.toDataURL();
        link.click();
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
            saveState();
        }
    });
};
