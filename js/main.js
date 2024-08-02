document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing application...');

    const translations = {
        en: {
            models: "Models",
            selectSkin: "Select Skin",
            animations: "Animations",
            scaleModel: "Scale Model",
            exportAnimation: "Export Animation",
            exportInstructions: "Press the button to start exporting the animation.",
            language: "Language:",
            loopAnimation: "Loop Animation",
            width: "Width:",
            height: "Height:",
            bitrate: "Bitrate (Mbps):",
            duration: "Duration (seconds):",
            format: "Format:"
        },
        es: {
            models: "Modelos",
            selectSkin: "Seleccionar Piel",
            animations: "Animaciones",
            scaleModel: "Escalar Modelo",
            exportAnimation: "Exportar Animación",
            exportInstructions: "Presiona el botón para comenzar a exportar la animación.",
            language: "Idioma:",
            loopAnimation: "Loop Animación",
            width: "Ancho:",
            height: "Alto:",
            bitrate: "Bitrate (Mbps):",
            duration: "Duración (segundos):",
            format: "Formato:"
        }
    };

    function setLanguage(language) {
        document.getElementById('modelHeader').textContent = translations[language].models;
        document.getElementById('skinHeader').textContent = translations[language].selectSkin;
        document.getElementById('animationHeader').textContent = translations[language].animations;
        document.getElementById('scaleLabel').textContent = translations[language].scaleModel;
        document.getElementById('openExportModal').textContent = translations[language].exportAnimation;
        document.getElementById('exportModalLabel').textContent = translations[language].exportAnimation;
        document.getElementById('exportInstruction').textContent = translations[language].exportInstructions;
        document.getElementById('languageLabel').textContent = translations[language].language;
        document.querySelector('.form-check-label').textContent = translations[language].loopAnimation;
        document.querySelector('label[for="exportWidth"]').textContent = translations[language].width;
        document.querySelector('label[for="exportHeight"]').textContent = translations[language].height;
        document.querySelector('label[for="exportBitrate"]').textContent = translations[language].bitrate;
        document.querySelector('label[for="exportDuration"]').textContent = translations[language].duration;
        document.querySelector('label[for="exportFormat"]').textContent = translations[language].format;
    }

    const userLang = navigator.language || navigator.userLanguage;
    const defaultLang = userLang.startsWith('es') ? 'es' : 'en';

    document.getElementById('languageSelect').value = defaultLang;
    setLanguage(defaultLang);

    document.getElementById('languageSelect').addEventListener('change', (event) => {
        setLanguage(event.target.value);
    });

    fetch('./data/models.json')
        .then(response => response.json())
        .then(models => {
            console.log('Models loaded:', models);
            const modelList = document.getElementById('modelList');
            models.forEach(model => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-group-item');
                listItem.textContent = model.name;
                listItem.addEventListener('click', () => loadModel(model.url));
                modelList.appendChild(listItem);
            });
        })
        .catch(error => console.error('Error al cargar el archivo JSON:', error));

    const app = new PIXI.Application({
        view: document.getElementById('stage'),
        width: window.innerWidth - 500,
        height: window.innerHeight,
        backgroundColor: 0x1099bb,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });

    let spineModel;
    let spineModelUrl;
    let isDragging = false;
    let lastPosition = { x: 0, y: 0 };
    let loopAnimation = true;

    function loadModel(url) {
        console.log('Loading model from URL:', url);
        spineModelUrl = url;
        app.stage.removeChildren();
        PIXI.Loader.shared
            .reset()
            .add('spineModel', url, { crossOrigin: true })
            .load((loader, resources) => {
                console.log('Model loaded:', resources);
                if (resources.spineModel && resources.spineModel.spineData) {
                    const spineData = resources.spineModel.spineData;
                    spineModel = new PIXI.spine.Spine(spineData);
                    resizeModel(spineModel);
                    app.stage.addChild(spineModel);
                    spineModel.state.setAnimation(0, 'Idle_01', loopAnimation);

                    spineModel.interactive = true;
                    spineModel.buttonMode = true;

                    spineModel.on('pointerdown', onDragStart)
                        .on('pointerup', onDragEnd)
                        .on('pointerupoutside', onDragEnd)
                        .on('pointermove', onDragMove);

                    loadAnimationButtons(spineData.animations);
                    loadSkinOptions(spineData.skins);
                } else {
                    console.error('Error loading spine model data:', resources);
                }
            });
    }

    function resizeModel(model) {
        console.log('Resizing model:', model);
        const canvasWidth = app.renderer.width;
        const canvasHeight = app.renderer.height;
        const modelWidth = model.width;
        const modelHeight = model.height;

        const scaleX = canvasWidth / modelWidth;
        const scaleY = canvasHeight / modelHeight;
        const scale = Math.min(scaleX, scaleY);

        model.scale.set(scale);

        model.x = (canvasWidth - modelWidth * scale) / 2 + 600;
        model.y = (canvasHeight - modelHeight * scale) / 2 + 1230;
    }

    function onDragStart(event) {
        isDragging = true;
        lastPosition = event.data.getLocalPosition(app.stage);
        event.stopPropagation();
    }

    function onDragEnd(event) {
        isDragging = false;
        event.stopPropagation();
    }

    function onDragMove(event) {
        if (isDragging) {
            const newPosition = event.data.getLocalPosition(app.stage);
            spineModel.x += newPosition.x - lastPosition.x;
            spineModel.y += newPosition.y - lastPosition.y;
            lastPosition = newPosition;
        }
    }

    document.getElementById('scaleSlider').addEventListener('input', (event) => {
        const scale = parseFloat(event.target.value);
        if (spineModel) {
            spineModel.scale.set(scale);
            resizeModel(spineModel);
        }
    });

    function loadAnimationButtons(animations) {
        const animationButtonsContainer = document.getElementById('animationButtons');
        animationButtonsContainer.innerHTML = '';
        animations.forEach(animation => {
            const button = document.createElement('button');
            button.classList.add('btn', 'btn-primary', 'm-1');
            button.textContent = animation.name;
            button.addEventListener('click', () => {
                spineModel.state.setAnimation(0, animation.name, loopAnimation);
            });
            animationButtonsContainer.appendChild(button);
        });
    }

    function loadSkinOptions(skins) {
        const skinSelect = document.getElementById('skinSelect');
        skinSelect.innerHTML = '';
        skins.forEach(skin => {
            const option = document.createElement('option');
            option.value = skin.name;
            option.textContent = skin.name;
            skinSelect.appendChild(option);
        });
        skinSelect.addEventListener('change', (event) => {
            const selectedSkin = event.target.value;
            spineModel.skeleton.setSkinByName(selectedSkin);
            spineModel.skeleton.setSlotsToSetupPose();
        });
    }

    // Función para exportar la animación como video
    function exportAnimationAsVideo(FPS = 60) {
        const exportWidth = parseInt(document.getElementById('exportWidth').value) || app.renderer.width;
        const exportHeight = parseInt(document.getElementById('exportHeight').value) || app.renderer.height;
        const exportBitrate = parseInt(document.getElementById('exportBitrate').value) * 1000000 || 5000000;
        const exportDuration = parseInt(document.getElementById('exportDuration').value) || null;
        const exportFormat = document.getElementById('exportFormat').value || 'video/webm';

        if (!spineModelUrl) {
            alert('No hay un modelo cargado.');
            return;
        }

        let exportCanvas = document.createElement("canvas");
        exportCanvas.id = "export-canvas";
        exportCanvas.style.display = "none";
        exportCanvas.width = exportWidth;
        exportCanvas.height = exportHeight;
        document.body.appendChild(exportCanvas);
        let exportVideo = document.createElement("video");
        exportVideo.controls = true;
        exportVideo.id = "export-video";

        let appExport = new PIXI.Application({
            width: exportWidth,
            height: exportHeight,
            view: exportCanvas,
        });

        appExport.loader
            .add('spineModel', spineModelUrl, { crossOrigin: true })
            .load(function (loader, res) {
                let exportChar = new PIXI.spine.Spine(res.spineModel.spineData);

                const modelWidth = exportChar.width;
                const modelHeight = exportChar.height;
                const scaleX = exportWidth / modelWidth;
                const scaleY = exportHeight / modelHeight;
                const scale = Math.min(scaleX, scaleY);

                exportChar.scale.set(scale);

                const offsetX = (exportWidth - modelWidth * scale) / 2;
                const offsetY = (exportHeight - modelHeight * scale) / 2;

                exportChar.x = offsetX + (exportChar.width - 950);
                exportChar.y = offsetY + (exportChar.height - 100);

                exportChar.state.setAnimation(0, 'Idle_01', true);

                appExport.stage.addChild(exportChar);

                // Export Section
                let videoStream = exportCanvas.captureStream(FPS); //default to 60
                let mediaRecorder = new MediaRecorder(videoStream, { mimeType: exportFormat, videoBitsPerSecond: exportBitrate });

                let chunks = [];
                mediaRecorder.ondataavailable = function (e) {
                    chunks.push(e.data);
                };

                mediaRecorder.onstop = function (e) {
                    let blob = new Blob(chunks, { type: exportFormat });
                    chunks = [];
                    let videoURL = URL.createObjectURL(blob);
                    exportVideo.src = videoURL;
                    document.getElementById('exportResult').appendChild(exportVideo);
                };

                let animLength = exportDuration ? exportDuration : 0;
                if (!exportDuration) {
                    for (var i in spineModel.spineData.animations) {
                        if (spineModel.spineData.animations[i].name == 'Idle_01') {
                            animLength = spineModel.spineData.animations[i].duration;
                            break;
                        }
                    }
                }

                mediaRecorder.start();
                setTimeout(function () {
                    mediaRecorder.stop();
                    appExport.stage.children.pop();
                    appExport.loader.resources = {};
                    exportCanvas.remove();
                }, animLength * 1000);
            });
    }

    document.getElementById('exportButton').addEventListener('click', () => exportAnimationAsVideo());

    document.getElementById('loopCheckbox').addEventListener('change', (event) => {
        loopAnimation = event.target.checked;
    });
});
