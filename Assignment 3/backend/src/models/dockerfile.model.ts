import mongoose from 'mongoose';

const dockerfileSchema = new mongoose.Schema({
    repositoryUrl: {
        type: String,
        required: true,
    },
    dockerfile: {
        type: String,
        required: true,
    },
    techStack: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const DockerfileModel = mongoose.model('Dockerfile', dockerfileSchema);