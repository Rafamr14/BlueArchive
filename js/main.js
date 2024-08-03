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
            selectSkin: "Seleccionar Skin",
            animations: "Animaciones",
            scaleModel: "Escalar Modelo",
            exportAnimation: "Exportar Animación",
            exportInstructions: "Presiona el botón para comenzar a exportar la animación.",
            language: "Idioma:",
            loopAnimation: "Loop Animación",
            width: "Ancho:",
            height: "Alto:",
            bitrate: "Bitrate (Mbps):",
            duración: "Duración (segundos):",
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

    let currentSelectedItem = null;
    let currentModel = null;
    let originalModelName = null;

    fetch('./data/models.json')
        .then(response => response.json())
        .then(models => {
            const modelList = document.getElementById('modelList');
            modelList.innerHTML = '';

            const modelItems = models.map(model => ({
                element: createListItem(model.name, model.url),
                originalName: model.name,
                newName: model.name // Inicialmente el nuevo nombre es igual al original
            }));

            fetch('./data/PathNames.json')
                .then(response => response.json())
                .then(nameMappings => {
                    nameMappings.forEach(mapping => {
                        const devName = mapping.DevName;
                        const pathName = mapping.PathName;

                        modelItems.forEach(item => {
                            if (item.originalName.includes(devName)) {
                                item.newName = item.originalName.replace(devName, pathName);
                                item.element.textContent = item.newName;
                            }
                        });
                    });

                    // Ordenar los elementos por el nuevo nombre
                    modelItems.sort((a, b) => a.newName.localeCompare(b.newName));

                    // Añadir los elementos ordenados al DOM
                    modelItems.forEach(item => modelList.appendChild(item.element));
                })
                .catch(error => console.error('Error fetching name mappings:', error));
        })
        .catch(error => console.error('Error fetching models:', error));

    function createListItem(name, url) {
        const listItem = document.createElement('li');
        listItem.classList.add('list-group-item');
        listItem.textContent = name;
        listItem.addEventListener('click', () => {
            if (currentSelectedItem) {
                currentSelectedItem.classList.remove('active');
            }
            listItem.classList.add('active');
            currentSelectedItem = listItem;
            currentModel = listItem.textContent; // Store the current model name
            originalModelName = name; // Store the original model name
            loadModel(url);
        });
        return listItem;
    }

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
        spineModelUrl = url;
        app.stage.removeChildren();
        PIXI.Loader.shared
            .reset()
            .add('spineModel', url, { crossOrigin: true })
            .load((loader, resources) => {
                if (resources.spineModel && resources.spineModel.spineData) {
                    const spineData = resources.spineModel.spineData;
                    spineModel = new PIXI.spine.Spine(spineData);
                    resizeModel(spineModel);
                    app.stage.addChild(spineModel);

                    if (originalModelName.endsWith('_home') || currentModel.endsWith('_home')) {
                        spineModel.state.setAnimation(0, 'Start_Idle_01', false);
                        spineModel.state.addListener({
                            complete: (track) => {
                                if (track.animation.name === 'Start_Idle_01') {
                                    spineModel.state.setAnimation(0, 'Idle_01', true);
                                }
                            }
                        });
                    } else {
                        spineModel.state.setAnimation(0, 'Idle_01', loopAnimation);
                    }

                    spineModel.interactive = true;
                    spineModel.buttonMode = true;

                    spineModel.on('pointerdown', onDragStart)
                        .on('pointerup', onDragEnd)
                        .on('pointerupoutside', onDragEnd)
                        .on('pointermove', onDragMove);

                    loadAnimationButtons(spineData.animations);
                    loadSkinOptions(spineData.skins);

                    // Reproducir audio automáticamente al cargar el modelo
                    playInitialAudio(originalModelName);
                }
            });
    }

    function resizeModel(model) {
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

    const animationAudioMap = {
        "Talk_01_A": [
            "MemorialLobby_1_1.ogg",
            "MemorialLobby_1_2.ogg",
            "MemorialLobby_1_3.ogg",
            "MemorialLobby_1_4.ogg",
            "MemorialLobby_1.ogg"
        ],
        "Talk_02_A": [
            "MemorialLobby_2_1.ogg",
            "MemorialLobby_2_2.ogg",
            "MemorialLobby_2_3.ogg",
            "MemorialLobby_2_4.ogg",
            "MemorialLobby_2.ogg"
        ],
        "Talk_03_A": [
            "MemorialLobby_3_1.ogg",
            "MemorialLobby_3_2.ogg",
            "MemorialLobby_3_3.ogg",
            "MemorialLobby_3_4.ogg",
            "MemorialLobby_3.ogg"
        ],
        "Talk_04_A": [
            "MemorialLobby_4_1.ogg",
            "MemorialLobby_4_2.ogg",
            "MemorialLobby_4_3.ogg",
            "MemorialLobby_4_4.ogg",
            "MemorialLobby_4_5.ogg",
            "MemorialLobby_4_6.ogg",
            "MemorialLobby_4.ogg"
        ],
        "Talk_05_A": [
            "MemorialLobby_5_1.ogg",
            "MemorialLobby_5_2.ogg",
            "MemorialLobby_5_3.ogg",
            "MemorialLobby_5_4.ogg",
            "MemorialLobby_5.ogg"
        ],
        "Talk_06_A": [
            "MemorialLobby_6_1.ogg",
            "MemorialLobby_6_2.ogg",
            "MemorialLobby_6_3.ogg",
            "MemorialLobby_6_4.ogg",
            "MemorialLobby_6.ogg"
        ],
    };

    function loadAnimationButtons(animations) {
        const animationButtonsContainer = document.getElementById('animationButtons');
        animationButtonsContainer.innerHTML = '';
        animations.forEach(animation => {
            const button = document.createElement('button');
            const animationId = `animation_${animation.name.replace(/\s+/g, '_')}`;
            button.id = animationId;
            button.classList.add('btn', 'btn-primary', 'm-1');
            button.textContent = animation.name;
            button.addEventListener('click', () => {
                const isLooping = document.getElementById('loopCheckbox').checked;
                spineModel.state.setAnimation(0, animation.name, isLooping);

                playAnimationAudio(animation.name);

                displayDialogForAnimation(originalModelName, animation.name);
            });
            animationButtonsContainer.appendChild(button);
        });
    }

    function playAnimationAudio(animationName) {
        const modelName = originalModelName.split('_')[0];
        const audioFiles = animationAudioMap[animationName];

        if (audioFiles && audioFiles.length > 0) {
            const audios = audioFiles.map(file => new Audio(`./audio/${modelName}_${file}`));
            playAudiosSequentially(audios);
        }
    }

    function playInitialAudio(modelName) {
        const baseName = modelName.split('_')[0];
        const audioFiles = [
            `./audio/${baseName}_MemorialLobby_0.ogg`,
            `./audio/${baseName}_MemorialLobby_0_1.ogg`,
            `./audio/${baseName}_MemorialLobby_0_2.ogg`,
            `./audio/${baseName}_MemorialLobby_0_3.ogg`
        ];
        const audios = audioFiles.map(file => new Audio(file));
        setTimeout(() => {
            playAudiosSequentially(audios);
        }, 3000); // 1000 ms = 1 segundo de retraso
    }

    function playAudiosSequentially(audios) {
        if (audios.length === 0) return;

        const [firstAudio, ...rest] = audios;

        firstAudio.play().catch(() => {
            if (rest.length > 0) {
                playAudiosSequentially(rest);
            }
        });

        firstAudio.addEventListener('ended', () => {
            if (rest.length > 0) {
                setTimeout(() => {
                    playAudiosSequentially(rest);
                }, 1000); // 1000 ms = 1 segundo de retraso
            }
        });
    }

    function displayDialogForAnimation(modelName, animationName) {
        fetch('./data/characterDialogs.json')
            .then(response => response.json())
            .then(dialogs => {
                const dialog = dialogs.find(d => d.Name === modelName && d.AnimationName === animationName);
                if (dialog) {
                    showDialog(dialog.LocalizeEN, dialog.Duration);
                }
            })
            .catch(error => console.error('Error fetching dialog data:', error));
    }

    function showDialog(text, duration) {
        const dialogElement = document.createElement('div');
        dialogElement.classList.add('dialog-box');
        dialogElement.textContent = text;
        document.body.appendChild(dialogElement);

        setTimeout(() => {
            dialogElement.remove();
        }, duration);
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

                let videoStream = exportCanvas.captureStream(FPS);
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
