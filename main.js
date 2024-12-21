class MapCreator {
  constructor() {
    this.canvas = document.getElementById('mapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.regions = [];
    this.places = [];
    this.currentPath = [];
    
    this.initializeCanvas();
    this.setupEventListeners();
  }

  initializeCanvas() {
    // Set canvas size to match its display size
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Set initial canvas state
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  setupEventListeners() {
    // Canvas event listeners
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.addEventListener('mousemove', this.draw.bind(this));
    this.canvas.addEventListener('mouseup', this.endDrawing.bind(this));
    this.canvas.addEventListener('mouseout', this.endDrawing.bind(this));

    // Button event listeners
    document.getElementById('addPlace').addEventListener('click', this.addPlace.bind(this));
    document.getElementById('saveMap').addEventListener('click', this.saveMap.bind(this));
    document.getElementById('loadMap').addEventListener('click', this.loadMap.bind(this));
    document.getElementById('clearMap').addEventListener('click', this.clearMap.bind(this));

    // Color picker event listener
    document.getElementById('colorPicker').addEventListener('change', (e) => {
      this.ctx.strokeStyle = e.target.value;
    });
  }

  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.currentPath = [pos];
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getMousePos(e);
    this.currentPath.push(pos);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
  }

  endDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.ctx.closePath();
    if (this.currentPath.length > 2) {
      this.regions.push({
        path: this.currentPath,
        color: document.getElementById('colorPicker').value
      });
    }
    this.currentPath = [];
  }

  addPlace() {
    const placeNameInput = document.getElementById('placeName');
    const placeName = placeNameInput.value.trim();
    
    if (placeName) {
      const pos = {
        x: this.canvas.width / 2,
        y: this.canvas.height / 2
      };
      
      this.places.push({ name: placeName, position: pos });
      this.redrawMap();
      placeNameInput.value = '';
    }
  }

  saveMap() {
    const mapData = {
      regions: this.regions,
      places: this.places
    };
    
    const blob = new Blob([JSON.stringify(mapData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historical-map.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const mapData = JSON.parse(event.target.result);
        this.regions = mapData.regions;
        this.places = mapData.places;
        this.redrawMap();
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }

  clearMap() {
    this.regions = [];
    this.places = [];
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  redrawMap() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Redraw regions
    this.regions.forEach(region => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = region.color;
      region.path.forEach((pos, index) => {
        if (index === 0) {
          this.ctx.moveTo(pos.x, pos.y);
        } else {
          this.ctx.lineTo(pos.x, pos.y);
        }
      });
      this.ctx.stroke();
      this.ctx.closePath();
    });
    
    // Redraw place names
    this.ctx.font = '14px Arial';
    this.ctx.fillStyle = '#000000';
    this.ctx.textAlign = 'center';
    this.places.forEach(place => {
      this.ctx.fillText(place.name, place.position.x, place.position.y);
    });
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
}

// Initialize the map creator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MapCreator();
});
