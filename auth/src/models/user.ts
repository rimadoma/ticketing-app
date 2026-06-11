import bcrypt from 'bcrypt';
import { pre, prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

@modelOptions({
    schemaOptions: {
        toJSON: {
            transform(_doc, ret) {
                return { id: ret._id.toString(), email: ret.email };
            }
        }
    }
})
// Hashes the password before any save that modifies it — covers both initial insert and
// explicit password changes. isModified guards against rehashing an already-hashed value
// on unrelated saves (e.g. a future profile update). Note: this logic lives here because
// it's idiomatic Mongoose/Typegoose, but it's ORM-coupled — if the DB layer changes,
// hashing must be moved to a UserService or similar.
@pre<User>('save', async function () {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
})
export class User {
    @prop({ type: () => String, required: true })
    public email!: string;

    @prop({ type: () => String, required: true })
    public password!: string;
}

export const UserModel = getModelForClass(User);
