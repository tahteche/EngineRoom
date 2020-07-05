import React, {useState, useEffect} from 'react'
import {Engine, Scene, ArcRotateCamera, SceneLoader} from 'babylonjs'
import 'babylonjs-loaders'
import {viewport} from '@airtable/blocks';



const EngineRoomCore = ({src}) => {
    const [canvas, setCanvas] = useState()

    const onResize = () => {
        if (engine) {
            engine.resize()
        }
    }


    const [engine, setEngine] = useState()
    useEffect(() => {
        if (canvas) {
            setEngine(createEngine(canvas))
        }
    }, [canvas])

    const [scene, setScene] = useState()
    useEffect(() => {
        if (engine) {
            canvas.addEventListener("resize", onResize)
            setScene(createScene(engine))
        }
    }, [engine])

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

    useEffect(() => {
        if (scene){
            engine.dispose()
            setEngine(createEngine(canvas))
        }
    }, [src])

    const setCanvasAndObserveSize = (canvas) => {
        if (canvas){
            setCanvas(canvas)
            let resizeObserver = new ResizeObserver(onResize)
            resizeObserver.observe(canvas)
        }
    }

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