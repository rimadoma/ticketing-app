import {  AppError } from '@ticketing/common';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const _mongoURL = 'auth-mongo-service';
const _port = 3000;
const _mongoPort = 27017;
const _dbName = 'auth';

async function openDbConnection(): Promise<void> {
    try {
        await mongoose.connect(`mongodb://${_mongoURL}:${_mongoPort}/${_dbName}`);
    } catch (err) {
        throw new AppError(err, 1233);
    }
}

if (!process.env.JWT_KEY) {
    throw new Error('JWT_KEY must be defined');
}

const app = await createApp();
await openDbConnection();
await app.listen({ port: _port, host: "0.0.0.0" });
console.log(`Listening on ${_port}`)