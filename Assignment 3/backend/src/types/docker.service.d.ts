declare module '../services/docker.service' {
  export class DockerService {
    cloneRepository(url: string, token: string): Promise<string>;
    detectTechStack(repoDir: string): Promise<string>;
    generateDockerfile(techStack: string, repoDir: string): Promise<string>;
    buildImage(dockerfile: string, repoDir: string): Promise<void>;
    cleanup(repoDir: string): void;
  }
}