import { Router, Request, Response } from 'express';
import { DockerfileModel } from '../models/dockerfile.model';
import { DockerService } from '../services/docker.service';

interface GenerateRequest extends Request {
body: {
repositoryUrl: string;
githubToken: string;
};
}

const router = Router();
const dockerService = new DockerService();

router.post('/generate', async (req: GenerateRequest, res: Response) => {
try {
const { repositoryUrl, githubToken } = req.body;
const repoDir = await dockerService.cloneRepository(repositoryUrl, githubToken);

try {
const techStack = await dockerService.detectTechStack(repoDir);
const dockerfile = await dockerService.generateDockerfile(techStack, repoDir);
await dockerService.buildImage(dockerfile, repoDir);

const newDockerfile = new DockerfileModel({ repositoryUrl, dockerfile, techStack });
await newDockerfile.save();

res.json({ success: true, data: { dockerfile, techStack } });
} finally {
dockerService.cleanup(repoDir);
}
} catch (error: any) {
console.error('Error generating Dockerfile:', error);
res.status(500).json({ success: false, error: error.message || 'Failed to generate Dockerfile' });
}
});

export default router;
