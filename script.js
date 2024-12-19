let animations = new Map(); // Store animations by file name
let currentAnimation = null;
let currentFileName = null;
let activeFileName = null;

document.getElementById('jsonInput').addEventListener('change', handleFileSelect);

async function handleFileSelect(event) {
    const files = event.target.files;
    const filesList = document.getElementById('filesList');
    filesList.className = 'mt-4 space-y-2 max-h-[300px] overflow-y-auto modern-scroll';
    const colorControls = document.getElementById('colorControls');
    
    // Validate file types
    for (const file of files) {
        if (!isValidFileType(file.name)) {
            alert(`Invalid file type: ${file.name}\nPlease upload only JSON or SVG files.`);
            return;
        }
    }
    
    for (const file of files) {
        try {
            if (animations.has(file.name)) {
                console.log(`File ${file.name} already exists`);
                continue;
            }

            const content = await readFile(file);
            let data;
            const isSvg = file.name.toLowerCase().endsWith('.svg');
            
            try {
                if (!isSvg) {
                    // Parse JSON content
                    data = JSON.parse(content);
                    
                    // Check if this is our custom JSON format containing SVG
                    if (data.type === 'svg' && data.content) {
                        // Handle as SVG
                        animations.set(file.name, {
                            original: data.content,
                            modified: data.content,
                            colors: data.metadata?.colors || extractColors(data.content),
                            type: 'svg'
                        });
                    } else {
                        // Handle as regular JSON/Lottie
                        animations.set(file.name, {
                            original: data,
                            modified: JSON.parse(JSON.stringify(data)),
                            colors: extractColors(data),
                            type: 'json'
                        });
                    }
                } else {
                    // Handle regular SVG file
                    data = content;
                    animations.set(file.name, {
                        original: data,
                        modified: data,
                        colors: extractColors(data),
                        type: 'svg'
                    });
                }
            } catch (e) {
                console.error(`Error parsing ${file.name}:`, e);
                alert(`Error parsing ${file.name}. Make sure it's a valid ${isSvg ? 'SVG' : 'JSON'} file.`);
                continue;
            }

            // Create file item with modern styling
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item flex items-center justify-between p-3 bg-gray-50 rounded-lg transition-colors cursor-pointer';
            
            // Create file name element with thumbnail
            const fileNameContainer = document.createElement('div');
            fileNameContainer.className = 'flex items-center gap-2 flex-1 min-w-0';
            
            // Create thumbnail container
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'file-thumbnail flex items-center justify-center';
            
            // Create thumbnail preview
            const thumbnail = document.createElement('div');
            thumbnail.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
            
            if (isSvg) {
                thumbnail.innerHTML = content;
            } else {
                // For JSON files, create a thumbnail using a simple render approach
                const tempContainer = document.createElement('div');
                tempContainer.style.cssText = 'width: 100%; height: 100%; position: relative;';
                thumbnail.appendChild(tempContainer);

                // Create animation with specific settings for thumbnail
                const anim = lottie.loadAnimation({
                    container: tempContainer,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: data,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet',
                        clearCanvas: true,
                    }
                });

                // Force immediate render of first frame
                anim.goToAndStop(0, true);
                
                // Ensure SVG is properly sized and centered
                const updateSvg = () => {
                    const svg = tempContainer.querySelector('svg');
                    if (svg) {
                        svg.style.cssText = `
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: 90%;
                            height: 90%;
                            display: block;
                        `;
                    }
                };

                // Try multiple times to ensure SVG is rendered
                const maxAttempts = 3;
                let attempts = 0;
                
                const checkAndUpdateSvg = () => {
                    if (attempts >= maxAttempts) return;
                    
                    const svg = tempContainer.querySelector('svg');
                    if (!svg && attempts < maxAttempts) {
                        attempts++;
                        setTimeout(checkAndUpdateSvg, 50);
                    } else if (svg) {
                        updateSvg();
                    }
                };

                // Start checking for SVG
                checkAndUpdateSvg();

                // Fallback in case animation fails
                setTimeout(() => {
                    if (!tempContainer.querySelector('svg')) {
                        console.warn('Fallback: Animation failed to load');
                        tempContainer.innerHTML = `
                            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6;">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                                    <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                                </svg>
                            </div>
                        `;
                    }
                }, 300);
            }
            
            thumbnailContainer.appendChild(thumbnail);
            
            const fileName = document.createElement('span');
            fileName.textContent = file.name;
            fileName.className = 'text-sm text-gray-700 truncate';
            
            fileNameContainer.appendChild(thumbnailContainer);
            fileNameContainer.appendChild(fileName);
            
            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'p-1 hover:bg-gray-200 rounded-full transition-colors ml-2';
            const deleteIcon = document.createElement('i');
            deleteIcon.setAttribute('data-lucide', 'x');
            deleteIcon.className = 'w-4 h-4 text-gray-500';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.title = 'Delete file';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteFile(file.name);
                refreshGlobalColors();
            };
            
            // Add click handler to the entire file item
            fileItem.onclick = () => {
                document.querySelectorAll('#filesList > div').forEach(item => {
                    item.classList.remove('selected');
                    item.classList.add('bg-gray-50');
                });
                fileItem.classList.remove('bg-gray-50');
                fileItem.classList.add('selected');
                activeFileName = file.name;
                loadAnimation(file.name);
            };
            
            fileItem.appendChild(fileNameContainer);
            fileItem.appendChild(deleteBtn);
            filesList.appendChild(fileItem);
            
            // Initialize Lucide icons for the new elements
            lucide.createIcons();

            // After successfully adding a file
            saveToLocalStorage(); // Save after each file is added

        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            alert(`Error processing ${file.name}. Please try again.`);
        }
    }

    // Create export buttons only if they don't exist
    if (animations.size > 0 && !document.querySelector('header .export-buttons')) {
        createExportButtons();
    }

    // Create or refresh global color editor
    if (!document.getElementById('globalColors')) {
        createGlobalColorEditor();
    } else {
        refreshGlobalColors();
    }

    // Select first file if none selected
    if (files.length > 0 && !currentFileName) {
        const firstFileItem = filesList.firstElementChild;
        firstFileItem.classList.remove('bg-gray-50');
        firstFileItem.classList.add('selected');
        activeFileName = files[0].name;
        loadAnimation(files[0].name);
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function extractColors(file) {
    const colors = new Set();
    
    function rgbToHex(rgb) {
        // Convert "rgb(255, 0, 0)" to "#FF0000"
        const rgbMatch = rgb.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (rgbMatch) {
            const [_, r, g, b] = rgbMatch;
            return `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`.toUpperCase();
        }
        return rgb;
    }
    
    if (typeof file === 'string' && file.includes('<svg')) {
        // Extract colors from SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(file, "image/svg+xml");
        
        // Get all elements with fill or stroke attributes
        const elements = svgDoc.querySelectorAll('[fill], [stroke]');
        elements.forEach(element => {
            const fill = element.getAttribute('fill');
            const stroke = element.getAttribute('stroke');
            
            if (fill && fill !== 'none' && fill !== 'currentColor') {
                colors.add(rgbToHex(fill));
            }
            if (stroke && stroke !== 'none' && stroke !== 'currentColor') {
                colors.add(rgbToHex(stroke));
            }
        });
        
        // Get colors from style attributes
        const styledElements = svgDoc.querySelectorAll('[style]');
        styledElements.forEach(element => {
            const style = element.getAttribute('style');
            const fillMatch = style.match(/fill:\s*([^;]+)/);
            const strokeMatch = style.match(/stroke:\s*([^;]+)/);
            
            if (fillMatch && fillMatch[1] !== 'none' && fillMatch[1] !== 'currentColor') {
                colors.add(rgbToHex(fillMatch[1]));
            }
            if (strokeMatch && strokeMatch[1] !== 'none' && strokeMatch[1] !== 'currentColor') {
                colors.add(rgbToHex(strokeMatch[1]));
            }
        });
    } else {
        // Extract colors from Lottie JSON
        function traverse(obj) {
            for (let key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    // Skip hidden layers
                    if (obj.hd === true || obj.hidden === true) {
                        continue;
                    }

                    if (Array.isArray(obj[key])) {
                        // Handle color arrays
                        if ((key === 'c' || key === 'k') && obj[key].length === 4) {
                            const value = obj[key];
                            if (typeof value[0] === 'number' && value[0] <= 1) {
                                colors.add(rgbaToHex(value));
                            }
                        } else if ((key === 'fc' || key === 'sc') && obj[key].length >= 3) {
                            const color = [...obj[key], 1].slice(0, 4);
                            colors.add(rgbaToHex(color));
                        }
                    }
                    traverse(obj[key]);
                }
            }
        }
        traverse(file);
    }
    
    return Array.from(colors);
}

function rgbaToHex([r, g, b, a]) {
    const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, alpha];
}

function loadAnimation(fileName) {
    currentFileName = fileName;
    
    const animData = animations.get(fileName);
    const colorControls = document.getElementById('colorControls');
    const container = document.getElementById('iconPreview');
    
    // Clear previous content
    colorControls.innerHTML = '';
    container.innerHTML = '';

    // Create preview modes container
    const previewModes = document.createElement('div');
    previewModes.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    
    // Light mode preview
    const lightModeContainer = createPreviewContainer('Light Mode', '#FFFFFF');
    const darkModeContainer = createPreviewContainer('Dark Mode', '#1A1A1A');
    
    previewModes.appendChild(lightModeContainer);
    previewModes.appendChild(darkModeContainer);
    container.appendChild(previewModes);

    // Create colors section
    const colorsSection = document.createElement('div');
    colorsSection.className = 'w-full';

    // Create section header
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'flex items-center justify-between mb-4 pb-3 border-b border-gray-200';

    // Left side with icon and title
    const headerLeft = document.createElement('div');
    headerLeft.className = 'flex items-center gap-2';
    headerLeft.innerHTML = `
        <i data-lucide="droplet" class="w-5 h-5 text-primary"></i>
        <h3 class="text-lg font-semibold text-gray-900">Colors</h3>
    `;

    // Right side with color count and reset button
    const headerRight = document.createElement('div');
    headerRight.className = 'flex items-center gap-2';

    // Color count badge
    const colorCount = document.createElement('div');
    colorCount.className = 'text-sm bg-gray-100 px-3 py-1 rounded-full text-gray-600';
    colorCount.textContent = `${animData.colors.length} colors detected`;

    // Reset button
    const resetButton = document.createElement('button');
    resetButton.className = 'flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-primary transition-colors';
    resetButton.innerHTML = `
        <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
        Reset
    `;

    // Add reset functionality
    resetButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all color changes?')) {
            // Reset the modified data to the original
            animData.modified = JSON.parse(JSON.stringify(animData.original));
            // Re-extract colors
            animData.colors = extractColors(animData.modified);
            // Reload the animation
            loadAnimation(fileName);
            // Refresh global colors
            refreshGlobalColors();
        }
    });

    headerRight.appendChild(colorCount);
    headerRight.appendChild(resetButton);

    sectionHeader.appendChild(headerLeft);
    sectionHeader.appendChild(headerRight);

    // Create color grid container with auto-fit columns
    const colorsGrid = document.createElement('div');
    colorsGrid.className = 'grid gap-3 w-full';
    colorsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';

    // Create color cards
    animData.colors.forEach((color) => {
        const colorCard = document.createElement('div');
        colorCard.className = 'bg-white border border-gray-200 rounded-lg p-3 hover:border-primary transition-colors w-full';
        colorCard.dataset.color = color;

        const cardContent = document.createElement('div');
        cardContent.className = 'flex items-center gap-3 w-full';

        // Color preview
        const colorPreview = document.createElement('div');
        colorPreview.className = 'w-8 h-8 rounded-md border border-gray-200 shadow-sm flex-shrink-0 cursor-pointer';
        colorPreview.style.backgroundColor = color;

        // Color input (hidden)
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = color;
        colorInput.className = 'sr-only';
        colorInput.dataset.currentColor = color;

        // Color info
        const colorInfo = document.createElement('div');
        colorInfo.className = 'flex-1 min-w-0';
        
        const hexValue = document.createElement('input');
        hexValue.type = 'text';
        hexValue.value = color.toUpperCase();
        hexValue.className = 'w-full text-sm font-medium text-gray-900 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none hover:bg-gray-100 px-1 rounded';
        hexValue.readOnly = false;

        // Apply button
        const applyButton = document.createElement('button');
        applyButton.className = 'p-1.5 text-xs text-white bg-primary rounded-full hover:bg-primary/90 transition-colors flex-shrink-0';
        applyButton.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i>`;

        // Click handler for the entire preview area
        colorPreview.addEventListener('click', () => {
            colorInput.click();
        });

        // Color input change handler
        colorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            colorPreview.style.backgroundColor = newColor;
            hexValue.value = newColor.toUpperCase();
        });

        // Apply button click handler
        applyButton.addEventListener('click', () => {
            const currentColor = colorInput.dataset.currentColor;
            const newColor = colorInput.value;
            if (currentColor !== newColor) {
                if (updateColor(fileName, currentColor, newColor)) {
                    colorInput.dataset.currentColor = newColor;
                    colorCard.dataset.color = newColor;
                }
            }
        });

        // Ajouter la validation du champ hexValue
        hexValue.addEventListener('input', (e) => {
            let value = e.target.value;
            if (value && !value.startsWith('#')) {
                value = '#' + value;
                e.target.value = value;
            }
        });

        hexValue.addEventListener('change', (e) => {
            let value = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(value)) {
                colorInput.value = value;
                colorPreview.style.backgroundColor = value;
            } else {
                e.target.value = colorInput.value.toUpperCase();
            }
        });

        // Assemble the card
        colorPreview.appendChild(colorInput);
        colorInfo.appendChild(hexValue);
        cardContent.appendChild(colorPreview);
        cardContent.appendChild(colorInfo);
        cardContent.appendChild(applyButton);
        colorCard.appendChild(cardContent);
        colorsGrid.appendChild(colorCard);
    });

    // Assemble the section
    colorsSection.appendChild(sectionHeader);
    colorsSection.appendChild(colorsGrid);

    // Clear and append to color controls
    colorControls.innerHTML = '';
    colorControls.appendChild(colorsSection);

    // Initialize icons
    lucide.createIcons();

    // Load the animation or SVG
    if (animData.type === 'svg') {
        const lightPreview = lightModeContainer.querySelector('.preview-content');
        const darkPreview = darkModeContainer.querySelector('.preview-content');
        
        lightPreview.innerHTML = animData.modified;
        darkPreview.innerHTML = animData.modified;
        
        // Scale SVGs
        container.querySelectorAll('svg').forEach(svg => {
            svg.style.width = '100%';
            svg.style.height = '100%';
            if (!svg.getAttribute('viewBox')) {
                svg.setAttribute('viewBox', '0 0 512 512');
            }
        });
    } else {
        if (currentAnimation) {
            if (currentAnimation.light) currentAnimation.light.destroy();
            if (currentAnimation.dark) currentAnimation.dark.destroy();
        }
        
        try {
            const lightPreview = lightModeContainer.querySelector('.preview-content');
            const darkPreview = darkModeContainer.querySelector('.preview-content');
            
            currentAnimation = {
                light: lottie.loadAnimation({
                    container: lightPreview,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: animData.modified,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                }),
                dark: lottie.loadAnimation({
                    container: darkPreview,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: animData.modified,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                })
            };
        } catch (error) {
            console.error('Error loading Lottie animation:', error);
            lightPreview.innerHTML = 'Error loading animation';
            darkPreview.innerHTML = 'Error loading animation';
        }
    }
}

function createPreviewContainer(title, bgColor) {
    const container = document.createElement('div');
    container.className = 'space-y-2';

    // Create header with title and color picker
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-2';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'text-sm font-medium text-gray-700';
    titleSpan.textContent = title;

    const colorControl = document.createElement('div');
    colorControl.className = 'flex items-center gap-2';

    // Create color picker button
    const colorPickerBtn = document.createElement('button');
    colorPickerBtn.className = 'w-6 h-6 rounded cursor-pointer border border-gray-300';
    colorPickerBtn.style.backgroundColor = bgColor;

    // Create hex input
    const colorHexInput = document.createElement('input');
    colorHexInput.type = 'text';
    colorHexInput.value = bgColor.toUpperCase();
    colorHexInput.className = 'w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent';
    colorHexInput.readOnly = false;

    colorControl.appendChild(colorPickerBtn);
    colorControl.appendChild(colorHexInput);
    header.appendChild(titleSpan);
    header.appendChild(colorControl);

    // Create preview content container
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-content aspect-square rounded-lg flex items-center justify-center overflow-hidden';
    previewContent.style.backgroundColor = bgColor;

    // Initialize Pickr
    const pickr = new Pickr({
        el: colorPickerBtn,
        theme: 'classic',
        defaultRepresentation: 'RGBA',
        default: bgColor,
        components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
                hex: true,
                rgba: true,
                hsla: false,
                hsva: false,
                cmyk: false,
                input: true,
                clear: true,
                save: true
            }
        }
    });

    // Handle color changes
    pickr.on('save', (color) => {
        if (color) {
            const rgba = color.toRGBA();
            const rgbaString = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
            colorPickerBtn.style.backgroundColor = rgbaString;
            colorHexInput.value = color.toHEXA().toString().toUpperCase();
            previewContent.style.backgroundColor = rgbaString;
        }
        pickr.hide();
    });

    // Handle hex input changes
    colorHexInput.addEventListener('input', (e) => {
        let value = e.target.value;
        // Ajouter automatiquement le # si manquant
        if (value && !value.startsWith('#')) {
            value = '#' + value;
            e.target.value = value;
        }
    });

    colorHexInput.addEventListener('change', (e) => {
        let value = e.target.value;
        // Valider le format hexadécimal
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            pickr.setColor(value);
            colorPickerBtn.style.backgroundColor = value;
            previewContent.style.backgroundColor = value;
        } else {
            // Restaurer la valeur précédente si invalide
            e.target.value = pickr.getColor().toHEXA().toString().toUpperCase();
        }
    });

    container.appendChild(header);
    container.appendChild(previewContent);
    return container;
}

function updateColor(fileName, oldColor, newColor) {
    const animData = animations.get(fileName);
    if (!animData) return false;

    let modified = false;
    
    // Convert Set to Array for indexOf operation
    const colorsArray = Array.from(animData.colors);
    const colorIndex = colorsArray.indexOf(oldColor);
    
    if (colorIndex !== -1) {
        // Update the color in the Set
        animData.colors.delete(oldColor);
        animData.colors.add(newColor);
        
        if (animData.type === 'svg') {
            // Update SVG content
            animData.modified = animData.modified.replace(
                new RegExp(`"${oldColor}"`, 'g'),
                `"${newColor}"`
            ).replace(
                new RegExp(`'${oldColor}'`, 'g'),
                `'${newColor}'`
            ).replace(
                new RegExp(`${oldColor}(?=[ ;])`, 'g'),
                newColor
            );
            modified = true;
        } else {
            // Update JSON/Lottie content
            const updateColors = (obj) => {
                if (Array.isArray(obj)) {
                    obj.forEach(item => updateColors(item));
                } else if (obj && typeof obj === 'object') {
                    Object.entries(obj).forEach(([key, value]) => {
                        if (typeof value === 'string' && value.toLowerCase() === oldColor.toLowerCase()) {
                            obj[key] = newColor;
                            modified = true;
                        } else if (value && typeof value === 'object') {
                            updateColors(value);
                        }
                    });
                }
            };
            
            updateColors(animData.modified);
        }
        
        // Update preview if this is the current file
        if (fileName === currentFileName) {
            loadAnimation(fileName);
        }
    }
    
    return modified;
}

function arraysAreClose(arr1, arr2, tolerance = 0.01) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, i) => Math.abs(val - arr2[i]) < tolerance);
}

function createExportButtons() {
    // Remove any existing export buttons first
    const existingButtons = document.querySelector('header .export-buttons');
    if (existingButtons) {
        existingButtons.remove();
    }

    // Create dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'export-buttons relative ml-auto';

    // Create main dropdown button
    const dropdownButton = document.createElement('button');
    dropdownButton.className = 'flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors text-sm';
    dropdownButton.innerHTML = `
        <i data-lucide="download" class="w-4 h-4"></i>
        Export
        <i data-lucide="chevron-down" class="w-4 h-4"></i>
    `;

    // Create dropdown menu
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden z-50';

    // Create menu items
    const menuItems = [
        {
            icon: 'image',
            text: 'Export as SVG',
            onClick: () => showExportDialog('svg')
        },
        {
            icon: 'image',
            text: 'Export as PNG',
            onClick: () => showExportDialog('png')
        },
        {
            icon: 'image',
            text: 'Export as JPG',
            onClick: () => showExportDialog('jpg')
        },
        {
            icon: 'file-json',
            text: 'Export as JSON',
            onClick: () => showExportDialog('json')
        },
        {
            icon: 'film',
            text: 'Export as GIF',
            onClick: () => showGifExportDialog()
        }
    ];

    menuItems.forEach(item => {
        const menuItem = document.createElement('button');
        menuItem.className = 'w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors';
        menuItem.innerHTML = `
            <i data-lucide="${item.icon}" class="w-4 h-4"></i>
            ${item.text}
        `;
        menuItem.onclick = () => {
            item.onClick();
            dropdownMenu.classList.add('hidden');
        };
        dropdownMenu.appendChild(menuItem);
    });

    // Toggle dropdown on button click
    dropdownButton.onclick = (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdownMenu.classList.add('hidden');
    });

    // Prevent dropdown from closing when clicking inside it
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Assemble dropdown
    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(dropdownMenu);

    // Add to header
    const header = document.querySelector('header h1');
    header.appendChild(dropdownContainer);

    // Initialize Lucide icons
    lucide.createIcons();
}

function showGifExportDialog() {
    // Get all JSON files
    const jsonFiles = Array.from(animations.entries())
        .filter(([_, data]) => data.type === 'json');

    if (jsonFiles.length === 0) {
        alert('No JSON animation files available to export as GIF');
        return;
    }

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900">Export Animation as GIF</h3>
        <button class="p-1 hover:bg-gray-100 rounded-full" id="closeModal">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    `;

    // Create settings section
    const settings = document.createElement('div');
    settings.className = 'space-y-4 mb-4';
    settings.innerHTML = `
        <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Dimensions</label>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs text-gray-500">Width</label>
                    <input type="number" id="gifWidth" value="512" min="32" max="1024" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                </div>
                <div>
                    <label class="text-xs text-gray-500">Height</label>
                    <input type="number" id="gifHeight" value="512" min="32" max="1024"
                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                </div>
            </div>
        </div>
        <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Quality</label>
            <input type="range" id="gifQuality" min="1" max="20" value="10" 
                   class="w-full">
            <div class="flex justify-between text-xs text-gray-500">
                <span>Higher Quality</span>
                <span>Smaller Size</span>
            </div>
        </div>
        <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Frame Rate</label>
            <select id="gifFrameRate" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
                <option value="15">15 FPS</option>
            </select>
        </div>
    `;
    
    // Create file list
    const fileList = document.createElement('div');
    fileList.className = 'space-y-2 max-h-60 overflow-y-auto';
    
    jsonFiles.forEach(([fileName, data]) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer';
        fileItem.innerHTML = `
            <i data-lucide="file-json" class="w-5 h-5 text-gray-500"></i>
            <span class="flex-1 text-sm text-gray-700">${fileName}</span>
        `;
        fileItem.onclick = () => {
            // Show convert button when a file is selected
            convertBtn.style.display = 'block';
            fileList.querySelectorAll('div').forEach(item => {
                item.classList.remove('ring-2', 'ring-primary');
            });
            fileItem.classList.add('ring-2', 'ring-primary');
            selectedFile = fileName;
        };
        fileList.appendChild(fileItem);
    });

    // Create convert button (hidden by default)
    const convertBtn = document.createElement('button');
    convertBtn.className = 'w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors mt-4';
    convertBtn.innerHTML = 'Start Conversion';
    convertBtn.style.display = 'none';
    
    let selectedFile = null;
    
    convertBtn.onclick = async () => {
        if (!selectedFile) return;
        
        const width = parseInt(document.getElementById('gifWidth').value);
        const height = parseInt(document.getElementById('gifHeight').value);
        const quality = parseInt(document.getElementById('gifQuality').value);
        const frameRate = parseInt(document.getElementById('gifFrameRate').value);
        
        document.body.removeChild(backdrop);
        await exportLottieAsGif(selectedFile, { width, height, quality, frameRate });
    };
    
    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(settings);
    modal.appendChild(fileList);
    modal.appendChild(convertBtn);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    // Initialize icons
    lucide.createIcons();
    
    // Add close handlers
    const closeModal = () => document.body.removeChild(backdrop);
    document.getElementById('closeModal').onclick = closeModal;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeModal();
    };
}

async function exportLottieAsGif(fileName, options = {}) {
    const {
        width = 512,
        height = 512,
        quality = 10,
        frameRate = 30
    } = options;

    const animData = animations.get(fileName);
    if (!animData || animData.type !== 'json') {
        alert('Please select a JSON animation file to export as GIF');
        return;
    }

    // Create loading indicator
    const loadingModal = document.createElement('div');
    loadingModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    loadingModal.innerHTML = `
        <div class="bg-white rounded-xl p-6 max-w-sm w-full mx-4 text-center">
            <div class="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-gray-600" id="exportProgress">Processing frames...</p>
        </div>
    `;
    document.body.appendChild(loadingModal);
    const progressText = loadingModal.querySelector('#exportProgress');

    try {
        // Create temporary container for the animation
        const container = document.createElement('div');
        container.style.cssText = `width: ${width}px; height: ${height}px; position: fixed; left: -9999px; background: transparent;`;
        document.body.appendChild(container);

        // Initialize Lottie animation
        const anim = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: animData.modified
        });

        // Wait for animation to load
        await new Promise((resolve) => {
            anim.addEventListener('DOMLoaded', resolve);
        });

        // Create GIF encoder
        const gif = new GIF({
            workers: 2,
            quality: quality,
            width: width,
            height: height,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
            transparent: 'rgba(0,0,0,0)', // Enable transparency in GIF
            background: 'rgba(0,0,0,0)'   // Set transparent background
        });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const totalFrames = anim.totalFrames;
        const frameDelay = Math.round(1000 / frameRate);

        // Process each frame
        for (let i = 0; i < totalFrames; i++) {
            progressText.textContent = `Processing frame ${i + 1} of ${totalFrames}`;
            
            // Go to frame and wait for it to render
            anim.goToAndStop(i, true);
            await new Promise(resolve => setTimeout(resolve, 50));

            // Get SVG content
            const svg = container.querySelector('svg');
            if (!svg) continue;

            // Convert SVG to image
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        gif.addFrame(canvas, { 
                            delay: frameDelay,
                            copy: true
                        });
                        
                        URL.revokeObjectURL(url);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = reject;
                img.src = url;
            });
        }

        // Render GIF
        progressText.textContent = 'Generating GIF...';
        const blob = await new Promise((resolve) => {
            gif.on('progress', p => {
                progressText.textContent = `Encoding: ${Math.round(p * 100)}%`;
            });
            
            gif.on('finished', (blob) => {
                resolve(blob);
            });

            gif.render();
        });

        // Force download using a temporary link
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.style.display = 'none';
        downloadLink.href = downloadUrl;
        downloadLink.download = `${fileName.replace('.json', '')}.gif`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);

        // Cleanup
        anim.destroy();
        document.body.removeChild(container);
        document.body.removeChild(loadingModal);
        gif.abort(); // Stop workers

    } catch (error) {
        console.error('Error creating GIF:', error);
        alert('Error creating GIF. Please try again.');
        if (document.body.contains(loadingModal)) {
            document.body.removeChild(loadingModal);
        }
    }
}

function svgToCanvas(svgElement) {
    return new Promise((resolve, reject) => {
        try {
            // Create canvas with fixed size
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Create image from SVG
            const svgURL = URL.createObjectURL(new Blob([svgElement.outerHTML], { type: 'image/svg+xml' }));
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Clear canvas and draw image
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(svgURL);
                    resolve(canvas);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(svgURL);
                reject(new Error('Failed to load SVG image'));
            };

            img.src = svgURL;
        } catch (error) {
            reject(error);
        }
    });
}

function deleteFile(fileName) {
    const fileItem = Array.from(document.querySelectorAll('.file-item'))
        .find(item => item.querySelector('.text-sm').textContent === fileName);
    
    if (fileItem) {
        fileItem.remove();
        animations.delete(fileName);
        saveToLocalStorage(); // Save after deletion
    }
}

function isValidFileType(fileName) {
    const validExtensions = ['.json', '.svg'];
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    return validExtensions.includes(ext);
}

async function exportAllSVG() {
    const zip = new JSZip();
    
    try {
        animations.forEach((animData, fileName) => {
            if (animData.type === 'svg') {
                // For SVG files, use the modified content directly
                zip.file(fileName, animData.modified);
            } else {
                // For JSON files, get the SVG from the Lottie animation
                const tempContainer = document.createElement('div');
                const anim = lottie.loadAnimation({
                    container: tempContainer,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: animData.modified
                });
                
                // Get the SVG content
                const svgContent = tempContainer.innerHTML;
                const baseName = fileName.replace('.json', '.svg');
                zip.file(baseName, svgContent);
                
                // Cleanup
                anim.destroy();
            }
        });
        
        // Generate and download zip
        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "all_svgs.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error exporting SVGs:', error);
        alert('Error exporting SVGs. Check console for details.');
    }
}

async function exportAllJSON() {
    try {
        const zip = new JSZip();
        
        animations.forEach((animData, fileName) => {
            const jsonString = JSON.stringify(animData.modified);
            zip.file(`modified_${fileName}`, jsonString);
        });
        
        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "all_modified_json.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting JSONs:', error);
        alert('Error exporting JSONs. Check console for details.');
    }
}

function showExportDialog(type) {
    // Get all files
    const files = Array.from(animations.entries());

    if (files.length === 0) {
        alert('No files available to export');
        return;
    }

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900">Export as ${type.toUpperCase()}</h3>
        <button class="p-1 hover:bg-gray-100 rounded-full" id="closeModal">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    `;

    // Create settings section
    const settings = document.createElement('div');
    settings.className = 'space-y-4 mb-4';
    
    if (type === 'svg') {
        settings.innerHTML = `
            <div class="space-y-4">
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Global Dimensions</label>
                    <div class="flex items-start gap-2">
                        <div class="space-y-1">
                            <label class="text-xs text-gray-500">Width</label>
                            <div class="flex items-center gap-1">
                                <input type="number" id="globalWidth" value="512" min="32" max="2048" 
                                    class="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm">
                                <span class="text-xs text-gray-500">px</span>
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs text-gray-500">Height</label>
                            <div class="flex items-center gap-1">
                                <input type="number" id="globalHeight" value="512" min="32" max="2048"
                                    class="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm">
                                <span class="text-xs text-gray-500">px</span>
                            </div>
                        </div>
                        <div class="flex items-end">
                            <button id="globalLockAspectRatio" class="p-2 hover:bg-gray-100 rounded-md" title="Link aspect ratio">
                                <i data-lucide="link" class="w-5 h-5 text-gray-500"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Background</label>
                    <select id="svgBackground" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                        <option value="transparent">Transparent</option>
                        <option value="white">White</option>
                        <option value="black">Black</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Optimization</label>
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="svgOptimize" class="rounded text-primary">
                        <label class="text-sm text-gray-600">Optimize SVG (remove unnecessary attributes)</label>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'png' || type === 'jpg') {
        settings.innerHTML = `
            <div class="space-y-4">
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Global Dimensions</label>
                    <div class="flex items-start gap-2">
                        <div class="space-y-1">
                            <label class="text-xs text-gray-500">Width</label>
                            <div class="flex items-center gap-1">
                                <input type="number" id="globalWidth" value="512" min="32" max="2048" 
                                    class="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm">
                                <span class="text-xs text-gray-500">px</span>
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs text-gray-500">Height</label>
                            <div class="flex items-center gap-1">
                                <input type="number" id="globalHeight" value="512" min="32" max="2048"
                                    class="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm">
                                <span class="text-xs text-gray-500">px</span>
                            </div>
                        </div>
                        <div class="flex items-end">
                            <button id="globalLockAspectRatio" class="p-2 hover:bg-gray-100 rounded-md" title="Link aspect ratio">
                                <i data-lucide="link" class="w-5 h-5 text-gray-500"></i>
                            </button>
                        </div>
                    </div>
                </div>
                ${type === 'jpg' ? `
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Quality</label>
                    <input type="range" id="jpgQuality" min="0" max="100" value="90" 
                        class="w-full">
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>Lower Quality</span>
                        <span id="qualityValue">90%</span>
                        <span>Best Quality</span>
                    </div>
                </div>
                ` : ''}
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Background</label>
                    <select id="imageBackground" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                        ${type === 'png' ? '<option value="transparent">Transparent</option>' : ''}
                        <option value="white">White</option>
                        <option value="black">Black</option>
                    </select>
                </div>
            </div>
        `;

        // In the showExportDialog function, move the JPG quality slider initialization after modal is added to DOM
        // Find this section:
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Initialize icons
        lucide.createIcons();

        // Add this after:
        if (type === 'jpg') {
            const qualitySlider = document.getElementById('jpgQuality');
            const qualityValue = document.getElementById('qualityValue');
            if (qualitySlider && qualityValue) {
                qualitySlider.addEventListener('input', (e) => {
                    qualityValue.textContent = `${e.target.value}%`;
                });
            }
        }
    } else if (type === 'json') {
        settings.innerHTML = `
            <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Format</label>
                <select id="jsonFormat" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="pretty">Pretty (readable)</option>
                    <option value="minified">Minified (smaller size)</option>
                </select>
            </div>
        `;
    }

    // Add file selection controls
    const fileSelectionControls = document.createElement('div');
    fileSelectionControls.className = 'space-y-2';
    fileSelectionControls.innerHTML = `
        <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-gray-700">Select Files</label>
            <div class="flex items-center gap-2">
                <button id="selectAll" class="text-xs text-primary hover:text-secondary">Select All</button>
                <button id="deselectAll" class="text-xs text-primary hover:text-secondary">Deselect All</button>
            </div>
        </div>
    `;
    
    // Create file list with checkboxes
    const fileList = document.createElement('div');
    fileList.className = 'space-y-2 max-h-60 overflow-y-auto';
    
    files.forEach(([fileName, data]) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'space-y-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100';
        
        // Create main file info row
        const fileInfo = document.createElement('div');
        fileInfo.className = 'flex items-center gap-3';
        fileInfo.innerHTML = `
            <input type="checkbox" class="rounded text-primary file-checkbox" data-filename="${fileName}">
            <i data-lucide="${data.type === 'json' ? 'file-json' : 'file-image'}" class="w-5 h-5 text-gray-500"></i>
            <span class="flex-1 text-sm text-gray-700">${fileName}</span>
            <span class="text-xs text-gray-500">${data.type.toUpperCase()}</span>
        `;

        // Create dimensions row
        const dimensionsRow = document.createElement('div');
        dimensionsRow.className = 'flex items-center gap-3 pl-8 hidden dimensions-row';
        dimensionsRow.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="space-y-1">
                    <div class="flex items-center gap-1">
                        <input type="number" class="w-20 px-2 py-1 border border-gray-300 rounded text-sm file-width" 
                               value="512" min="32" max="2048">
                        <span class="text-xs text-gray-500">×</span>
                        <input type="number" class="w-20 px-2 py-1 border border-gray-300 rounded text-sm file-height" 
                               value="512" min="32" max="2048">
                        <span class="text-xs text-gray-500">px</span>
                    </div>
                </div>
                <button class="link-dimensions p-1 hover:bg-gray-200 rounded" title="Link width and height">
                    <i data-lucide="link" class="w-4 h-4 text-gray-500"></i>
                </button>
                <button class="sync-with-global p-1 hover:bg-gray-200 rounded" title="Lock to global dimensions">
                    <i data-lucide="lock" class="w-4 h-4 text-gray-500"></i>
                </button>
            </div>
        `;

        fileItem.appendChild(fileInfo);
        fileItem.appendChild(dimensionsRow);
        fileList.appendChild(fileItem);
    });

    fileSelectionControls.appendChild(fileList);

    // Create export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors mt-4';
    exportBtn.innerHTML = 'Export Selected Files';

    // Initialize global dimensions controls
    modal.appendChild(header);
    modal.appendChild(settings);
    modal.appendChild(fileSelectionControls);
    modal.appendChild(exportBtn);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Initialize icons
    lucide.createIcons();

    // Initialize global dimensions controls if it's SVG export
    if (type === 'svg') {
        const globalWidthInput = document.getElementById('globalWidth');
        const globalHeightInput = document.getElementById('globalHeight');
        const globalLockButton = document.getElementById('globalLockAspectRatio');
        let isGlobalLocked = true;
        let globalAspectRatio = 1;

        const updateGlobalLockIcon = () => {
            globalLockButton.innerHTML = `<i data-lucide="${isGlobalLocked ? 'link' : 'unlink'}" class="w-5 h-5 text-gray-500"></i>`;
            lucide.createIcons();
        };

        const updateAllFileDimensions = () => {
            const width = globalWidthInput.value;
            const height = globalHeightInput.value;
            document.querySelectorAll('.file-width').forEach(input => input.value = width);
            document.querySelectorAll('.file-height').forEach(input => input.value = height);
        };

        globalLockButton.onclick = () => {
            isGlobalLocked = !isGlobalLocked;
            if (isGlobalLocked) {
                globalAspectRatio = globalWidthInput.value / globalHeightInput.value;
            }
            updateGlobalLockIcon();
        };

        globalWidthInput.oninput = () => {
            if (isGlobalLocked && !isNaN(globalAspectRatio)) {
                globalHeightInput.value = Math.round(globalWidthInput.value / globalAspectRatio);
            }
            updateAllFileDimensions();
        };

        globalHeightInput.oninput = () => {
            if (isGlobalLocked && !isNaN(globalAspectRatio)) {
                globalWidthInput.value = Math.round(globalHeightInput.value * globalAspectRatio);
            }
            updateAllFileDimensions();
        };

        updateGlobalLockIcon();
        updateAllFileDimensions();
    }

    // Handle select/deselect all
    const handleSelectAll = (select) => {
        const checkboxes = fileList.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = select;
            const dimensionsRow = checkbox.closest('.space-y-3').querySelector('.dimensions-row');
            dimensionsRow.classList.toggle('hidden', !select);
        });
    };

    // Add event listeners
    document.getElementById('selectAll').onclick = () => handleSelectAll(true);
    document.getElementById('deselectAll').onclick = () => handleSelectAll(false);

    // Add checkbox change listeners
    fileList.querySelectorAll('.file-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const dimensionsRow = checkbox.closest('.space-y-3').querySelector('.dimensions-row');
            dimensionsRow.classList.toggle('hidden', !checkbox.checked);
        });
    });
    
    // Export button click handler
    if (type === 'json') {
        exportBtn.onclick = async () => {
            const selectedFiles = Array.from(fileList.querySelectorAll('.file-checkbox:checked'))
                .map(checkbox => checkbox.dataset.filename);
            
            if (selectedFiles.length === 0) {
                alert('Please select at least one file to export');
                return;
            }

            const format = document.getElementById('jsonFormat').value;
            document.body.removeChild(backdrop);

            try {
                const zip = new JSZip();
                let hasFiles = false;
                
                for (const fileName of selectedFiles) {
                    const animData = animations.get(fileName);
                    if (!animData) {
                        console.warn(`Animation data not found for ${fileName}`);
                        continue;
                    }

                    try {
                        let jsonData;
                        if (animData.type === 'json') {
                            // For JSON files, use the modified data directly
                            console.log(`Processing JSON file: ${fileName}`);
                            jsonData = animData.modified;
                        } else if (animData.type === 'svg') {
                            // For SVG files, create a JSON structure
                            console.log(`Converting SVG to JSON: ${fileName}`);
                            jsonData = {
                                type: "svg",
                                version: "1.0",
                                content: animData.modified,
                                metadata: {
                                    fileName: fileName,
                                    originalFormat: "svg",
                                    exportedAt: new Date().toISOString(),
                                    colors: animData.colors
                                }
                            };
                        }

                        if (!jsonData) {
                            console.warn(`No valid data found for ${fileName}`);
                            continue;
                        }

                        const content = format === 'pretty' 
                            ? JSON.stringify(jsonData, null, 2)
                            : JSON.stringify(jsonData);

                        if (!content) {
                            console.warn(`Failed to stringify data for ${fileName}`);
                            continue;
                        }

                        // Create new filename with .json extension
                        const newFileName = fileName.replace(/\.(json|svg)$/, '.json');
                        zip.file(newFileName, content);
                        hasFiles = true;
                        console.log(`Successfully added ${newFileName} to zip`);
                    } catch (fileError) {
                        console.error(`Error processing file ${fileName}:`, fileError);
                    }
                }

                if (!hasFiles) {
                    throw new Error('No files were processed for export');
                }

                console.log('Generating zip file...');
                const content = await zip.generateAsync({type: "blob"});
                
                if (!content || content.size === 0) {
                    throw new Error('Generated zip file is empty');
                }

                console.log(`Zip file generated, size: ${content.size} bytes`);
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_json_${new Date().getTime()}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('Export completed successfully');

            } catch (error) {
                console.error('Detailed error exporting JSON files:', error);
                alert(`Error exporting JSON files: ${error.message}`);
            }
        };
    } else if (type === 'png' || type === 'jpg') {
        exportBtn.onclick = async () => {
            const selectedFiles = Array.from(fileList.querySelectorAll('.file-checkbox:checked'))
                .map(checkbox => checkbox.dataset.filename);
            
            if (selectedFiles.length === 0) {
                alert('Please select at least one file to export');
                return;
            }

            const width = parseInt(document.getElementById('globalWidth').value);
            const height = parseInt(document.getElementById('globalHeight').value);
            const background = document.getElementById('imageBackground').value;
            const quality = type === 'jpg' ? parseInt(document.getElementById('jpgQuality').value) : undefined;

            document.body.removeChild(backdrop);

            try {
                const zip = new JSZip();
                
                for (const fileName of selectedFiles) {
                    const svgContent = await getSVGContent(fileName, {
                        width,
                        height,
                        background,
                        scaleMode: 'fit'
                    });

                    if (svgContent) {
                        const imageBlob = await exportAsImage(svgContent, {
                            width,
                            height,
                            type,
                            quality,
                            background
                        });

                        const newFileName = fileName.replace(/\.(json|svg)$/, `.${type}`);
                        zip.file(newFileName, imageBlob);
                    }
                }

                const content = await zip.generateAsync({type: "blob"});
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_${type}_${new Date().getTime()}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

            } catch (error) {
                console.error(`Error exporting ${type} files:`, error);
                alert(`Error exporting ${type} files. Please try again.`);
            }
        };
    }
    
    // Add close handlers
    const closeModal = () => document.body.removeChild(backdrop);
    document.getElementById('closeModal').onclick = closeModal;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeModal();
    };
}

async function getSVGContent(fileName, options) {
    const {
        width = 512,
        height = 512,
        background = 'transparent',
        optimize = false,
        scaleMode = 'fit'
    } = options;

    const animData = animations.get(fileName);
    if (!animData) return null;

    let svgContent = '';
    
    if (animData.type === 'svg') {
        // For SVG files
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(animData.modified, 'image/svg+xml');
        const svg = svgDoc.querySelector('svg');
        
        // Get original viewBox or create one from width/height
        let viewBox = svg.getAttribute('viewBox');
        if (!viewBox) {
            const originalWidth = parseFloat(svg.getAttribute('width')) || 512;
            const originalHeight = parseFloat(svg.getAttribute('height')) || 512;
            viewBox = `0 0 ${originalWidth} ${originalHeight}`;
        }
        const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        
        // Calculate scaling to maintain aspect ratio
        const scale = Math.min(width / vbWidth, height / vbHeight);
        const scaledWidth = vbWidth * scale;
        const scaledHeight = vbHeight * scale;
        const translateX = (width - scaledWidth) / 2;
        const translateY = (height - scaledHeight) / 2;
        
        // Set new dimensions
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        
        // Create wrapper group for content
        const wrapper = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Add background if needed
        if (background !== 'transparent') {
            const rect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '100%');
            rect.setAttribute('height', '100%');
            rect.setAttribute('fill', background);
            svg.appendChild(rect);
        }
        
        // Move all original content to wrapper
        while (svg.firstChild) {
            if (svg.firstChild.tagName !== 'rect') {
                wrapper.appendChild(svg.firstChild);
            } else {
                svg.firstChild.remove();
            }
        }
        
        // Set transform on wrapper
        wrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
        svg.appendChild(wrapper);
        
        svgContent = new XMLSerializer().serializeToString(svgDoc);
    } else {
        // For JSON/Lottie files
        const tempContainer = document.createElement('div');
        tempContainer.style.width = `${width}px`;
        tempContainer.style.height = `${height}px`;
        
        const anim = lottie.loadAnimation({
            container: tempContainer,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: animData.modified,
            rendererSettings: {
                preserveAspectRatio: 'xMidYMid meet'
            }
        });
        
        await new Promise(resolve => {
            anim.addEventListener('DOMLoaded', () => {
                const svg = tempContainer.querySelector('svg');
                if (svg) {
                    // Get original viewBox
                    let viewBox = svg.getAttribute('viewBox');
                    if (!viewBox) {
                        viewBox = '0 0 512 512';
                    }
                    const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
                    
                    // Calculate scaling
                    const scale = Math.min(width / vbWidth, height / vbHeight);
                    const scaledWidth = vbWidth * scale;
                    const scaledHeight = vbHeight * scale;
                    const translateX = (width - scaledWidth) / 2;
                    const translateY = (height - scaledHeight) / 2;
                    
                    // Set new dimensions
                    svg.setAttribute('width', width);
                    svg.setAttribute('height', height);
                    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
                    
                    // Create wrapper group
                    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    
                    // Add background if needed
                    if (background !== 'transparent') {
                        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        rect.setAttribute('width', '100%');
                        rect.setAttribute('height', '100%');
                        rect.setAttribute('fill', background);
                        svg.appendChild(rect);
                    }
                    
                    // Move all original content to wrapper
                    while (svg.firstChild) {
                        if (svg.firstChild.tagName !== 'rect') {
                            wrapper.appendChild(svg.firstChild);
                        } else {
                            svg.firstChild.remove();
                        }
                    }
                    
                    // Set transform on wrapper
                    wrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
                    svg.appendChild(wrapper);
                }
                resolve();
            });
        });
        
        svgContent = tempContainer.innerHTML;
        anim.destroy();
    }
    
    return svgContent;
}

// Add this CSS to style scrollbars
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .modern-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
    }
    .modern-scroll::-webkit-scrollbar {
        width: 4px;
    }
    .modern-scroll::-webkit-scrollbar-track {
        background: transparent;
    }
    .modern-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 2px;
    }
    .modern-scroll::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.8);
    }
    
    .file-thumbnail {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        background-color: #f3f4f6;
        overflow: hidden;
        flex-shrink: 0;
    }
    
    .file-item {
        transition: all 0.2s ease;
    }
    
    .file-item.selected {
        background-color: rgb(99 102 241) !important;
    }
    
    .file-item.selected * {
        color: white !important;
    }
    
    .file-item:hover:not(.selected) {
        background-color: #f3f4f6;
    }
`;
document.head.appendChild(styleSheet);

function createGlobalColorEditor() {
    const globalColorSection = document.createElement('div');
    globalColorSection.className = 'mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-4';
    header.innerHTML = `
        <h3 class="text-sm font-medium text-gray-700 flex items-center gap-2">
            <i data-lucide="droplet" class="w-4 h-4 text-primary"></i>
            Global Colors
        </h3>
        <button id="refreshGlobalColors" class="text-xs text-primary hover:text-secondary flex items-center gap-1">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            Refresh
        </button>
    `;

    // Create colors container with grid layout
    const colorsContainer = document.createElement('div');
    colorsContainer.id = 'globalColors';
    colorsContainer.className = 'color-grid modern-scroll max-h-48 overflow-y-auto pr-2';

    // Add to section
    globalColorSection.appendChild(header);
    globalColorSection.appendChild(colorsContainer);

    // Add refresh handler
    globalColorSection.querySelector('#refreshGlobalColors').onclick = refreshGlobalColors;

    // Add to page after files list
    const filesList = document.getElementById('filesList');
    filesList.after(globalColorSection);

    // Initialize icons
    lucide.createIcons();

    // Initial color refresh
    refreshGlobalColors();
}

function refreshGlobalColors() {
    const globalColors = new Map();
    
    // Collect all unique colors from all files
    animations.forEach((animData, fileName) => {
        animData.colors.forEach(color => {
            if (!globalColors.has(color)) {
                globalColors.set(color, new Set([fileName]));
            } else {
                globalColors.get(color).add(fileName);
            }
        });
    });

    const colorsContainer = document.getElementById('globalColors');
    colorsContainer.innerHTML = '';

    if (globalColors.size === 0) {
        colorsContainer.innerHTML = `
            <div class="text-sm text-gray-500 text-center py-2">
                No colors found. Upload some files to get started.
            </div>
        `;
        return;
    }

    globalColors.forEach((files, color) => {
        const colorControl = document.createElement('div');
        colorControl.className = 'relative group flex items-center gap-2 p-2 rounded-lg bg-white hover:bg-gray-50 transition-colors';
        colorControl.dataset.color = color;
        
        // Color preview with picker
        const colorPreview = document.createElement('div');
        colorPreview.className = 'relative w-6 h-6 rounded cursor-pointer border border-gray-200';
        colorPreview.style.backgroundColor = color;
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = color;
        colorInput.dataset.currentColor = color;
        colorInput.className = 'absolute inset-0 opacity-0 cursor-pointer';
        
        // Color info
        const colorInfo = document.createElement('div');
        colorInfo.className = 'flex-1 min-w-0';

        const colorText = document.createElement('input');
        colorText.type = 'text';
        colorText.value = color.toUpperCase();
        colorText.className = 'text-sm font-medium text-gray-900 bg-transparent border-0 w-full focus:ring-0 focus:outline-none hover:bg-gray-100 px-1 rounded';
        colorText.readOnly = false;

        // Files count
        const filesCount = document.createElement('div');
        filesCount.className = 'text-xs text-gray-500';
        filesCount.textContent = `${files.size} file${files.size > 1 ? 's' : ''}`;

        // Apply button
        const applyButton = document.createElement('button');
        applyButton.className = 'hidden group-hover:flex p-1.5 text-xs text-white bg-primary rounded-full hover:bg-primary/90 transition-colors';
        applyButton.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i>`;

        // Files tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'hidden group-hover:block absolute left-full ml-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50 max-w-xs whitespace-normal';
        tooltip.textContent = Array.from(files).join(', ');

        // Event handlers for colorText
        colorText.addEventListener('input', (e) => {
            let value = e.target.value;
            if (value && !value.startsWith('#')) {
                value = '#' + value;
                e.target.value = value;
            }
        });

        colorText.addEventListener('change', (e) => {
            let value = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(value)) {
                colorInput.value = value;
                colorPreview.style.backgroundColor = value;
            } else {
                e.target.value = colorInput.value.toUpperCase();
            }
        });

        // Event handler for colorInput
        colorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            colorPreview.style.backgroundColor = newColor;
            colorText.value = newColor.toUpperCase();
        });

        // Apply button click handler
        applyButton.addEventListener('click', () => {
            const currentColor = colorInput.dataset.currentColor;
            const newColor = colorInput.value;
            if (currentColor !== newColor) {
                // Update color in all affected files
                let anyModified = false;
                files.forEach(fileName => {
                    if (updateColor(fileName, currentColor, newColor)) {
                        anyModified = true;
                    }
                });
                
                if (anyModified) {
                    colorInput.dataset.currentColor = newColor;
                    colorControl.dataset.color = newColor;
                }
            }
        });

        // Assemble the components
        colorPreview.appendChild(colorInput);
        colorInfo.appendChild(colorText);
        colorInfo.appendChild(filesCount);
        colorControl.appendChild(colorPreview);
        colorControl.appendChild(colorInfo);
        colorControl.appendChild(applyButton);
        colorControl.appendChild(tooltip);
        
        colorsContainer.appendChild(colorControl);
    });

    // Initialize new icons
    lucide.createIcons();
}

async function exportAsImage(svgString, options) {
    const { width, height, type, quality, background } = options;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Set background
    if (background !== 'transparent') {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
    }
    
    // Create SVG blob
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // Load image
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
    });
    
    // Draw image
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    
    // Convert to blob
    const mimeType = type === 'png' ? 'image/png' : 'image/jpeg';
    const imageBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, mimeType, type === 'jpg' ? quality / 100 : undefined);
    });
    
    return imageBlob;
} 

// Add these functions at the top of your script
function saveToLocalStorage() {
    const animationsData = Array.from(animations.entries()).map(([fileName, data]) => {
        return {
            fileName,
            data: {
                original: data.original,
                modified: data.modified,
                colors: Array.from(data.colors),
                type: data.type
            }
        };
    });
    
    try {
        localStorage.setItem('savedAnimations', JSON.stringify(animationsData));
        console.log('Animations saved to local storage');
    } catch (error) {
        console.error('Error saving to local storage:', error);
        // If storage is full, try to clear old data
        if (error.name === 'QuotaExceededError') {
            localStorage.clear();
            try {
                localStorage.setItem('savedAnimations', JSON.stringify(animationsData));
            } catch (retryError) {
                console.error('Failed to save even after clearing storage:', retryError);
            }
        }
    }
}

function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('savedAnimations');
        if (savedData) {
            const animationsData = JSON.parse(savedData);
            animationsData.forEach(({fileName, data}) => {
                animations.set(fileName, {
                    original: data.original,
                    modified: data.modified,
                    colors: new Set(data.colors),
                    type: data.type
                });
            });
            console.log('Animations loaded from local storage');
            return true;
        }
    } catch (error) {
        console.error('Error loading from local storage:', error);
    }
    return false;
}

// Add this to your initialization code (at the end of your script)
document.addEventListener('DOMContentLoaded', () => {
    // Load saved animations
    if (loadFromLocalStorage()) {
        // Recreate the file list UI for loaded animations
        const filesList = document.getElementById('filesList');
        filesList.className = 'mt-4 space-y-2 max-h-[300px] overflow-y-auto modern-scroll';
        
        animations.forEach((data, currentFileName) => {
            // Create file item
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item flex items-center justify-between p-3 bg-gray-50 rounded-lg transition-colors cursor-pointer';
            
            // Create file name container
            const fileNameContainer = document.createElement('div');
            fileNameContainer.className = 'flex items-center gap-2 flex-1 min-w-0';
            
            // Create thumbnail container
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'file-thumbnail flex items-center justify-center';
            
            // Create thumbnail
            const thumbnail = document.createElement('div');
            thumbnail.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-center;';
            
            if (data.type === 'svg') {
                thumbnail.innerHTML = data.modified;
            } else {
                const tempContainer = document.createElement('div');
                tempContainer.style.cssText = 'width: 100%; height: 100%; position: relative;';
                thumbnail.appendChild(tempContainer);

                const anim = lottie.loadAnimation({
                    container: tempContainer,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: data.modified,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet',
                        clearCanvas: true,
                    }
                });

                anim.goToAndStop(0, true);
            }
            
            thumbnailContainer.appendChild(thumbnail);
            
            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = currentFileName;
            fileNameSpan.className = 'text-sm text-gray-700 truncate';
            
            fileNameContainer.appendChild(thumbnailContainer);
            fileNameContainer.appendChild(fileNameSpan);
            
            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'p-1 hover:bg-gray-200 rounded-full transition-colors ml-2';
            const deleteIcon = document.createElement('i');
            deleteIcon.setAttribute('data-lucide', 'x');
            deleteIcon.className = 'w-4 h-4 text-gray-500';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.title = 'Delete file';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteFile(currentFileName);
                refreshGlobalColors();
            };
            
            // Add click handler to the entire file item
            fileItem.onclick = () => {
                document.querySelectorAll('#filesList > div').forEach(item => {
                    item.classList.remove('selected');
                    item.classList.add('bg-gray-50');
                });
                fileItem.classList.remove('bg-gray-50');
                fileItem.classList.add('selected');
                activeFileName = currentFileName;
                loadAnimation(currentFileName);
            };
            
            fileItem.appendChild(fileNameContainer);
            fileItem.appendChild(deleteBtn);
            filesList.appendChild(fileItem);
        });

        // Initialize Lucide icons
        lucide.createIcons();
        
        // Create export buttons if needed
        if (animations.size > 0 && !document.querySelector('header .export-buttons')) {
            createExportButtons();
        }

        // Create or refresh global color editor
        if (!document.getElementById('globalColors')) {
            createGlobalColorEditor();
        } else {
            refreshGlobalColors();
        }

        // Load the first file automatically
        if (animations.size > 0) {
            const firstFileName = animations.keys().next().value;
            const firstFileItem = filesList.firstElementChild;
            if (firstFileItem && firstFileName) {
                firstFileItem.classList.remove('bg-gray-50');
                firstFileItem.classList.add('selected');
                activeFileName = firstFileName;
                currentFileName = firstFileName;
                loadAnimation(firstFileName);
            }
        }
    }
});