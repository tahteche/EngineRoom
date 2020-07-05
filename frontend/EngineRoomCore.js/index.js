import React, {useState, useEffect} from 'react'
import {Engine, Scene, ArcRotateCamera, SceneLoader} from 'babylonjs'
import 'babylonjs-loaders'
import {viewport} from '@airtable/blocks';



const EngineRoomCore = ({src}) => {
    const [canvas, setCanvas] = useState()

    // Need to resize the engine when ever the canvas resizes e.g when this block
    // or the blocks sidebar goes into fullscreen mode
    const onResize = () => {
        if (engine) {
            engine.resize()
        }
    }

    // Babylon Engine depends on the existence of a canvas so create it when the canvas has been setup
    const [engine, setEngine] = useState()
    useEffect(() => {
        if (canvas) {
            setEngine(createEngine(canvas))
        }
    }, [canvas])

    // Babylon Scene depends on the existence of Babylon Engine so create it when the Engine has been setup
    const [scene, setScene] = useState()
    useEffect(() => {
        if (engine) {
            canvas.addEventListener("resize", onResize)
            setScene(createScene(engine))
        }
    }, [engine])

    // After Babylon Scene has been setup then configure camera, import the 3D mesh (the asset to be previewed)
    // and setup the environment so its well centered, etc
    useEffect(() => {
        if (scene) {

            let camera = new BABYLON.ArcRotateCamera("Camera", 0, 0, 0, BABYLON.Vector3.Zero(), scene);
            camera.setPosition(new BABYLON.Vector3(5, 5, -5));
            camera.attachControl(canvas, true);

            SceneLoader.ImportMesh("", src, undefined, scene,
                (meshes) => {
                    scene.createDefaultCameraOrLight(true, true, true);
                    scene.createDefaultEnvironment();
                }
            )

            engine.runRenderLoop(() => {
                scene.render()
            })


        }
    }, [scene])

    // When ever the asset to be previewd changes clear the environment and set things up again to preview
    // the new asset. We don't display both assets
    useEffect(() => {
        if (scene){
            engine.dispose()
            setEngine(createEngine(canvas))
        }
    }, [src])

    const setCanvasAndObserveSize = (canvas) => {
        if (canvas){
            setCanvas(canvas)

            // When the blocks sidebar (not the block itself) is in fullscreen mode it modifies the size of the block
            // this will catch that and resize the engine, keeping things need
            let resizeObserver = new ResizeObserver(onResize)
            resizeObserver.observe(canvas)
        }
    }

    // Resize engine when the block is in fullscreen mode
    viewport.watch("isFullscreen", onResize)

    return <canvas ref={(ref) => {setCanvasAndObserveSize(ref)}} style={{width: "100%", height:"100%"}} ></canvas>
}

const createScene = (engine) => {
    let s = new Scene(engine)
    return s
}

const createEngine = (canvas) => {
     return new Engine(canvas)
}

export default EngineRoomCore