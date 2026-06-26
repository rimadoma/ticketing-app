import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const _port = 3000;

async function openDbConnection(): Promise<void> {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
    } catch (err) {
        throw new AppError(err, AppErrorIds.DB_CONNECTION_ERROR);
    }
}

if (!process.env.JWT_KEY) {
    throw new Error('JWT_KEY must be defined');
}

if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined');
}

const app = await createApp();
await openDbConnection();
await app.listen({ port: _port, host: "0.0.0.0" });
console.log(`Auth listening on ${_port}`)