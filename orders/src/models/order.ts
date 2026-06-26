import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

export enum OrderStatus {
    Pending = 'pending',
    Paid = 'paid',
    Expired = 'expired'
}

@modelOptions({
    schemaOptions: {
        toJSON: {
            transform(_doc, ret) {
                return {
                    id: ret._id.toString(),
                    userId: ret.userId,
                    status: ret.status,
                    ticketId: ret.ticketId,
                    expiresAt: ret.expiresAt,
                };
            }
        }
    }
})
export class Order {
    @prop({ type: () => String, required: true })
    public userId!: string;

    @prop({ type: () => String, enum: OrderStatus, required: true, default: OrderStatus.Pending })
    public status!: OrderStatus;

    @prop({ type: () => String, required: true })
    public ticketId!: string;

    @prop({ type: () => Date, required: true })
    public expiresAt!: Date;
}

export const OrderModel = getModelForClass(Order);
