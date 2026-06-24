import { Routes } from './routes.js';

export default interface Event {
    route: Routes;
    data: unknown;
}