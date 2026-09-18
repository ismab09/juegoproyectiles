/**
 * graphs.js - Sistema de gráficas cinemáticas para el simulador de tiro libre
 * Genera 4 gráficos: Posición X vs T, Posición Y vs T, Velocidad VX vs T, Velocidad VY vs T
 */

const GraphSystem = {
    ctxX: null,
    ctxY: null,
    ctxVx: null,
    ctxVy: null,
    canvasX: null,
    canvasY: null,
    canvasVx: null,
    canvasVy: null,
    
    init: function() {
        this.canvasX = document.getElementById('graphX');
        this.canvasY = document.getElementById('graphY');
        this.canvasVx = document.getElementById('graphVx');
        this.canvasVy = document.getElementById('graphVy');
        
        if (this.canvasX) this.ctxX = this.canvasX.getContext('2d');
        if (this.canvasY) this.ctxY = this.canvasY.getContext('2d');
        if (this.canvasVx) this.ctxVx = this.canvasVx.getContext('2d');
        if (this.canvasVy) this.ctxVy = this.canvasVy.getContext('2d');
        
        // Configurar tamaño real de los canvas
        this.setupCanvasSize();
    },
    
    setupCanvasSize: function() {
        const canvases = [this.canvasX, this.canvasY, this.canvasVx, this.canvasVy];
        canvases.forEach(canvas => {
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * window.devicePixelRatio;
                canvas.height = rect.height * window.devicePixelRatio;
                const ctx = canvas.getContext('2d');
                ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }
        });
    },
    
    /**
     * Genera las 4 gráficas después de un tiro
     * @param {Array} flightPoints - Puntos de la trayectoria con {t, x, y, z}
     * @param {Object} params - Parámetros del tiro {vi, alphaDeg, latRad}
     */
    drawGraphs: function(flightPoints, params) {
        if (!this.ctxX || !flightPoints || flightPoints.length === 0) return;
        
        const { vi, alphaDeg } = params;
        const alphaRad = alphaDeg * Math.PI / 180;
        const g = Physics.g;
        
        // Calcular datos para cada gráfica
        const dataX = [];
        const dataY = [];
        const dataVx = [];
        const dataVy = [];
        
        let maxT = 0;
        let maxX = 0;
        let maxY = 0;
        let minVy = 0;
        let maxVy = vi * Math.sin(alphaRad);
        
        flightPoints.forEach(pt => {
            const t = pt.t;
            const x = pt.x;
            const y = pt.y;
            
            // Velocidades
            const vx = vi * Math.cos(alphaRad) + Physics.getAx() * t;
            const vy = vi * Math.sin(alphaRad) - g * t;
            
            dataX.push({ t, x });
            dataY.push({ t, y });
            dataVx.push({ t, vx });
            dataVy.push({ t, vy });
            
            maxT = Math.max(maxT, t);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            minVy = Math.min(minVy, vy);
        });
        
        // Dibujar cada gráfica
        this.drawGraph(this.ctxX, dataX, 't (s)', 'X (m)', 
            [dataX.map(d => d.t)], [dataX.map(d => d.x)],
            ['#38bdf8'], ['Posición X'],
            0, maxT * 1.05, 0, maxY * 1.1);
            
        this.drawGraph(this.ctxY, dataY, 't (s)', 'Y (m)',
            [dataY.map(d => d.t)], [dataY.map(d => d.y)],
            ['#f59e0b'], ['Posición Y'],
            0, maxT * 1.05, 0, maxY * 1.15);
            
        this.drawGraph(this.ctxVx, dataVx, 't (s)', 'Vx (m/s)',
            [dataVx.map(d => d.t)], [dataVx.map(d => d.vx)],
            ['#10b981'], ['Velocidad X'],
            0, maxT * 1.05, 
            Math.min(0, Math.min(...dataVx.map(d => d.vx))) * 0.95,
            Math.max(vi, Math.max(...dataVx.map(d => d.vx))) * 1.05);
            
        this.drawGraph(this.ctxVy, dataVy, 't (s)', 'Vy (m/s)',
            [dataVy.map(d => d.t)], [dataVy.map(d => d.vy)],
            ['#f43f5e'], ['Velocidad Y'],
            0, maxT * 1.05,
            Math.min(-15, minVy) * 1.05,
            Math.max(15, maxVy) * 1.05);
    },
    
    /**
     * Dibuja una gráfica individual
     */
    drawGraph: function(ctx, data, xlabel, ylabel, xDataArrays, yDataArrays, colors, labels, minX, maxX, minY, maxY) {
        if (!ctx) return;
        
        const width = ctx.canvas.width / window.devicePixelRatio;
        const height = ctx.canvas.height / window.devicePixelRatio;
        const padding = { top: 25, right: 20, bottom: 35, left: 50 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        
        // Limpiar canvas
        ctx.clearRect(0, 0, width, height);
        
        // Fondo
        ctx.fillStyle = 'rgba(6, 18, 33, 0.8)';
        ctx.fillRect(0, 0, width, height);
        
        // Título de ejes
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(xlabel, width / 2, height - 8);
        
        ctx.save();
        ctx.translate(12, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(ylabel, 0, 0);
        ctx.restore();
        
        // Funciones de escala
        const scaleX = (val) => padding.left + ((val - minX) / (maxX - minX)) * plotWidth;
        const scaleY = (val) => padding.top + plotHeight - ((val - minY) / (maxY - minY)) * plotHeight;
        
        // Dibujar grid
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        
        // Grid vertical (tiempo)
        const numXGrids = 5;
        for (let i = 0; i <= numXGrids; i++) {
            const xVal = minX + (maxX - minX) * (i / numXGrids);
            const x = scaleX(xVal);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotHeight);
            ctx.stroke();
            
            // Etiquetas X
            ctx.fillStyle = '#64748b';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(xVal.toFixed(2), x, height - 18);
        }
        
        // Grid horizontal (valor)
        const numYGrids = 4;
        for (let i = 0; i <= numYGrids; i++) {
            const yVal = minY + (maxY - minY) * (i / numYGrids);
            const y = scaleY(yVal);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotWidth, y);
            ctx.stroke();
            
            // Etiquetas Y
            ctx.fillStyle = '#64748b';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(yVal.toFixed(1), padding.left - 8, y + 4);
        }
        
        // Ejes principales
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
        ctx.stroke();
        
        // Dibujar cada línea de datos
        xDataArrays.forEach((xData, idx) => {
            const yData = yDataArrays[idx];
            const color = colors[idx];
            const label = labels[idx];
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            
            xData.forEach((xVal, i) => {
                const x = scaleX(xVal);
                const y = scaleY(yData[i]);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // Puntos destacados
            ctx.fillStyle = color;
            xData.forEach((xVal, i) => {
                if (i % Math.max(1, Math.floor(xData.length / 12)) === 0) {
                    const x = scaleX(xVal);
                    const y = scaleY(yData[i]);
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });
        
        // Leyenda
        let legendX = padding.left + 10;
        labels.forEach((label, idx) => {
            const color = colors[idx];
            ctx.fillStyle = color;
            ctx.fillRect(legendX, 8, 12, 12);
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '11px system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(label, legendX + 16, 18);
            legendX += 80;
        });
    },
    
    show: function() {
        const panel = document.getElementById('graphsPanel');
        if (panel) {
            panel.classList.add('show');
            this.setupCanvasSize();
        }
    },
    
    hide: function() {
        const panel = document.getElementById('graphsPanel');
        if (panel) {
            panel.classList.remove('show');
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    GraphSystem.init();
    
    // Botón de cerrar
    const closeBtn = document.getElementById('closeGraphsBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => GraphSystem.hide());
    }
});
