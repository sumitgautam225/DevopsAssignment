


### Multi-Stage Benefits:
1. **Smaller Image Size**: 3MB reduction (2.2% smaller)
2. **Better Security**: Only runtime artifacts are included in final image
3. **Cleaner Build Process**: Build dependencies are isolated from runtime
4. **Better Caching**: Build stage can be cached independently

### Multi-Stage Drawbacks:
1. **More Complex**: Requires understanding of multi-stage concepts
2. **Build Time**: Slightly longer build time due to multiple stages
3. **Debugging**: More complex to debug build issues

## Test Results

### Container Functionality
Both containers were successfully tested and are fully functional:

1. **Multi-stage container**:
   - ✅ Started successfully
   - ✅ Responds to `GET /` endpoint
   - ✅ Responds to `GET /greet` endpoint
   - ✅ Health check passes

2. **Single-stage container**:
   - ✅ Started successfully
   - ✅ Responds to `GET /` endpoint
   - ✅ Responds to `GET /greet` endpoint
   - ✅ Health check passes

### Test Commands Used:
```bash
# Build images
docker build -f Dockerfile.multistage -t assignment2-multistage .
docker build -f Dockerfile.single -t assignment2-single .

# Run containers
docker run -d -p 3000:3000 --name assignment2-multistage-container assignment2-multistage
docker run -d -p 3000:3000 --name assignment2-single-container assignment2-single

# Test endpoints
curl http://localhost:3000
curl http://localhost:3000/greet
```

## Conclusion

For this simple Node.js application, the multi-stage build provides:
- **2.2% smaller image size** (3MB reduction)
- **Better security posture** with minimal runtime artifacts
- **Cleaner separation** of build and runtime concerns

The size difference is modest for this simple application, but the benefits become more significant with:
- Larger applications with more dependencies
- Applications requiring build tools (TypeScript, Webpack, etc.)
- Production environments where security and minimal attack surface are priorities

## Files Included
- `Dockerfile.multistage` - Multi-stage Dockerfile
- `Dockerfile.single` - Single-stage Dockerfile
- `app.js` - Node.js Express application
- `package.json` - Dependencies configuration
- `DOCKER_COMPARISON_RESULTS.md` - This comparison document
