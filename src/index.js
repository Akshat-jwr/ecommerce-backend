import express from "express";
import DBConnect from "./db/index.js"
import dotenv from 'dotenv';
import {app} from './app.js'

dotenv.config({ path: './.env'})
const port = process.env.PORT || 8000;

DBConnect()
.then(() => {
    app.listen(port, ()=>{
        console.log(`App running at http://localhost:${port}`);
    })
})
.catch((err) => {
    console.log("MongoDB connection failed ",err);
})
