import React, {useState, useEffect} from 'react'
import {Engine, Scene, ArcRotateCamera, SceneLoader} from 'babylonjs'
import 'babylonjs-loaders'



const EngineRoom = ({src}) => {
    const [canvas, setCanvas] = useState()

    const [engine, setEngine] = useState()
    useEffect(() => {
        if (canvas) {
            let e = new Engine(canvas)
            setEngine(e)
            console.log("engine set")
            console.log(canvas, engine)
        }
    }, [canvas])

    const [scene, setScene] = useState()
    useEffect(() => {
        if (engine) {
            let s = new Scene(engine)
            setScene(s)
            console.log("scene is set")
            console.log(engine)
        }
    }, [engine])

    useEffect(() => {
        if (scene) {

            SceneLoader.ImportMesh("", src, undefined, scene,
                (meshes) => {
                    console.log("yolo", meshes)
                    scene.createDefaultCameraOrLight(true, true, true);
                    scene.createDefaultEnvironment();
            })

            let camera = new BABYLON.ArcRotateCamera("Camera", 0, 0, 0, BABYLON.Vector3.Zero(), scene);
            camera.setPosition(new BABYLON.Vector3(5, 5, -5));
            camera.attachControl(canvas, true);
            let light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);

            console.log("loader is set")
            console.log(scene)

            engine.runRenderLoop(() => {
                scene.render()
            })


        }
    }, [scene])

    return <canvas ref={(ref) => {setCanvas(ref)}}></canvas>
}

export default EngineRoom