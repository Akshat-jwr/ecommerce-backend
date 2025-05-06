import dotenv from 'dotenv';
// Load environment variables first
dotenv.config({ path: './.env'});

import express from "express";
import DBConnect from "./db/index.js"
import {app} from './app.js'

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
