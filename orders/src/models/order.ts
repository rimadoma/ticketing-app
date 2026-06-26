import { prop, getModelForClass, modelOptions, type Ref } from '@typegoose/typegoose';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
export { OrderStatus };
import { Ticket } from './ticket.js';

@modelOptions({
    schemaOptions: {
        toJSON: {
            transform(_doc, ret) {
                return {
                    id: ret._id.toString(),
                    userId: ret.userId,
                    status: ret.status,
                    ticket: ret.ticket,
                    expiresAt: ret.expiresAt,
                };
            }
        }
    }
})
export class Order {
    @prop({ type: () => String, required: true })
    public userId!: string;

    @prop({ type: () => String, enum: OrderStatus, required: true, default: OrderStatus.Created })
    public status!: OrderStatus;

    @prop({ ref: () => Ticket, required: true })
    public ticket!: Ref<Ticket>;

    @prop({ type: () => Date, required: true })
    public expiresAt!: Date;
}

export const OrderModel = getModelForClass(Order);
