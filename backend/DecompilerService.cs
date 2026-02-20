using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using ICSharpCode.Decompiler;
using ICSharpCode.Decompiler.CSharp;
using ICSharpCode.Decompiler.Metadata;
using ICSharpCode.Decompiler.TypeSystem;

class DecompilerService
{
    private const int Port = 3721;
    private static readonly string UploadDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
    
    public static async Task Main(string[] args)
    {
        if (!Directory.Exists(UploadDir))
        {
            Directory.CreateDirectory(UploadDir);
        }
        
        var listener = new HttpListener();
        listener.Prefixes.Add($"http://*:{Port}/");
        listener.Start();
        
        Console.WriteLine($"Decompiler Service running on port {Port}");
        Console.WriteLine("Press Ctrl+C to stop...");
        
        while (true)
        {
            var context = await listener.GetContextAsync();
            _ = HandleRequest(context);
        }
    }
    
    private static async Task HandleRequest(HttpListenerContext context)
    {
        var request = context.Request;
        var response = context.Response;
        
        // CORS headers
        response.AddHeader("Access-Control-Allow-Origin", "*");
        response.AddHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        response.AddHeader("Access-Control-Allow-Headers", "Content-Type");
        
        if (request.HttpMethod == "OPTIONS")
        {
            response.StatusCode = 200;
            response.Close();
            return;
        }
        
        try
        {
            var path = request.Url?.AbsolutePath ?? "/";
            
            switch (path)
            {
                case "/api/health":
                    await SendJsonResponse(response, new { status = "ok", timestamp = DateTime.UtcNow });
                    break;
                    
                case "/api/upload":
                    await HandleUpload(request, response);
                    break;
                    
                case "/api/assemblies":
                    await HandleListAssemblies(response);
                    break;
                    
                case "/api/types":
                    await HandleListTypes(request, response);
                    break;
                    
                case "/api/decompile":
                    await HandleDecompile(request, response);
                    break;
                    
                case "/api/search":
                    await HandleSearch(request, response);
                    break;
                    
                case "/api/fs/list":
                    await HandleListDirectory(request, response);
                    break;
                    
                case "/api/fs/open":
                    await HandleOpenFile(request, response);
                    break;
                    
                default:
                    if (path.StartsWith("/api/assembly/") && request.HttpMethod == "DELETE")
                    {
                        await HandleDeleteAssembly(path, response);
                    }
                    else if (path.StartsWith("/api/assembly/") && path.EndsWith("/open-folder") && request.HttpMethod == "POST")
                    {
                        await HandleOpenInFileManager(path, response);
                    }
                    else if (path.StartsWith("/api/assembly/") && path.EndsWith("/export-project") && request.HttpMethod == "POST")
                    {
                        await HandleExportProject(path, response);
                    }
                    else if (path.StartsWith("/api/file/"))
                    {
                        await HandleServeFile(path, response);
                    }
                    else
                    {
                        response.StatusCode = 404;
                        await SendJsonResponse(response, new { error = "Not found" });
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
        finally
        {
            response.Close();
        }
    }
    
    private static async Task HandleUpload(HttpListenerRequest request, HttpListenerResponse response)
    {
        if (request.ContentType?.StartsWith("multipart/form-data") != true)
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "Expected multipart/form-data" });
            return;
        }
        
        var boundary = GetBoundary(request.ContentType);
        var files = await ParseMultipartData(request.InputStream, boundary);
        
        if (files.Count == 0)
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "No files uploaded" });
            return;
        }
        
        var uploadedFiles = new List<object>();
        
        foreach (var file in files)
        {
            var fileId = Guid.NewGuid().ToString("N");
            var fileName = file.Key;
            var fileData = file.Value;
            
            // Determine file extension
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            var savedFileName = $"{fileId}{ext}";
            var filePath = Path.Combine(UploadDir, savedFileName);
            
            await File.WriteAllBytesAsync(filePath, fileData);
            
            uploadedFiles.Add(new
            {
                id = fileId,
                name = fileName,
                size = fileData.Length,
                path = savedFileName
            });
        }
        
        await SendJsonResponse(response, new { files = uploadedFiles });
    }
    
    private static async Task HandleListAssemblies(HttpListenerResponse response)
    {
        var assemblies = new List<object>();
        
        foreach (var file in Directory.GetFiles(UploadDir))
        {
            var ext = Path.GetExtension(file).ToLowerInvariant();
            if (ext == ".dll" || ext == ".exe")
            {
                try
                {
                    using var stream = File.OpenRead(file);
                    using var peReader = new PEReader(stream);
                    var reader = peReader.GetMetadataReader();
                    var assemblyDef = reader.GetAssemblyDefinition();
                    var assemblyName = reader.GetString(assemblyDef.Name);
                    
                    assemblies.Add(new
                    {
                        id = Path.GetFileNameWithoutExtension(file),
                        name = assemblyName,
                        fileName = Path.GetFileName(file),
                        version = assemblyDef.Version.ToString()
                    });
                }
                catch
                {
                    // Skip files that aren't valid .NET assemblies
                }
            }
        }
        
        await SendJsonResponse(response, new { assemblies });
    }
    
    private static async Task HandleListTypes(HttpListenerRequest request, HttpListenerResponse response)
    {
        var assemblyId = request.QueryString["assembly"];
        if (string.IsNullOrEmpty(assemblyId))
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "Missing assembly parameter" });
            return;
        }
        
        var assemblyPath = FindAssembly(assemblyId);
        if (assemblyPath == null)
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "Assembly not found" });
            return;
        }
        
        var types = new List<object>();
        
        try
        {
            var decompiler = CreateDecompiler(assemblyPath);
            var typeSystem = decompiler.TypeSystem;
            var mainModule = typeSystem.MainModule;
            
            var typeDefinitions = mainModule.TopLevelTypeDefinitions;
            foreach (var type in typeDefinitions)
            {
                try
                {
                    types.Add(BuildTypeTree(type));
                }
                catch (Exception typeEx)
                {
                    Console.WriteLine($"Failed to process type {type.Name}: {typeEx.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"HandleListTypes error: {ex}");
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
            return;
        }
        
        await SendJsonResponse(response, new { types });
    }
    
    private static CSharpDecompiler CreateDecompiler(string assemblyPath)
    {
        var settings = new DecompilerSettings();
        
        // Create assembly resolver that looks for dependencies in:
        // 1. Same directory as the assembly
        // 2. Runtime directories
        var assemblyDirectory = Path.GetDirectoryName(assemblyPath) ?? "";
        
        // Determine target framework from assembly or use default
        string targetFramework = "net10.0";
        
        // Use the simpler constructor that works with the actual API
        var resolver = new UniversalAssemblyResolver(assemblyPath, false, targetFramework);
        
        // Add the assembly directory as a search path for dependencies
        resolver.AddSearchDirectory(assemblyDirectory);
        
        // Add runtime directories
        var runtimeDir = Path.GetDirectoryName(typeof(object).Assembly.Location);
        if (runtimeDir != null)
        {
            resolver.AddSearchDirectory(runtimeDir);
        }
        
        // Also add the current application's directory (where ICSharpCode.Decompiler.dll is)
        var appDir = AppContext.BaseDirectory;
        if (!string.IsNullOrEmpty(appDir) && appDir != assemblyDirectory)
        {
            resolver.AddSearchDirectory(appDir);
        }
        
        return new CSharpDecompiler(assemblyPath, resolver, settings);
    }
    
    private static object BuildTypeTree(ITypeDefinition type)
    {
        var children = new List<object>();
        
        // Add nested types
        foreach (var nestedType in type.NestedTypes)
        {
            children.Add(BuildTypeTree(nestedType));
        }
        
        // Add methods
        foreach (var method in type.Members.OfType<IMethod>())
        {
            if (method.IsConstructor)
            {
                children.Add(new
                {
                    name = method.Name == ".ctor" ? "Constructor" : "Static Constructor",
                    kind = "constructor",
                    fullName = method.FullName
                });
            }
            else
            {
                children.Add(new
                {
                    name = method.Name,
                    kind = "method",
                    fullName = method.FullName
                });
            }
        }
        
        // Add properties
        foreach (var prop in type.Members.OfType<IProperty>())
        {
            children.Add(new
            {
                name = prop.Name,
                kind = "property",
                fullName = prop.FullName
            });
        }
        
        // Add fields
        foreach (var field in type.Members.OfType<IField>())
        {
            children.Add(new
            {
                name = field.Name,
                kind = "field",
                fullName = field.FullName
            });
        }
        
        // Add events
        foreach (var evt in type.Members.OfType<IEvent>())
        {
            children.Add(new
            {
                name = evt.Name,
                kind = "event",
                fullName = evt.FullName
            });
        }
        
        return new
        {
            name = type.Name,
            fullName = type.FullName,
            @namespace = type.Namespace,
            kind = type.Kind.ToString().ToLowerInvariant(),
            children
        };
    }
    
    private static async Task HandleDecompile(HttpListenerRequest request, HttpListenerResponse response)
    {
        var assemblyId = request.QueryString["assembly"];
        var typeName = request.QueryString["type"];
        
        if (string.IsNullOrEmpty(assemblyId))
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "Missing assembly parameter" });
            return;
        }
        
        var assemblyPath = FindAssembly(assemblyId);
        if (assemblyPath == null)
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "Assembly not found" });
            return;
        }
        
        try
        {
            var decompiler = CreateDecompiler(assemblyPath);
            string code;
            
            if (!string.IsNullOrEmpty(typeName))
            {
                // Decompile specific type
                code = decompiler.DecompileTypeAsString(new FullTypeName(typeName));
            }
            else
            {
                // Decompile entire assembly - get all types
                var typeSystem = decompiler.TypeSystem;
                var sb = new StringBuilder();
                
                foreach (var type in typeSystem.MainModule.TopLevelTypeDefinitions)
                {
                    try
                    {
                        var typeCode = decompiler.DecompileTypeAsString(type.FullTypeName);
                        sb.AppendLine(typeCode);
                        sb.AppendLine();
                    }
                    catch (Exception typeEx)
                    {
                        sb.AppendLine($"// Failed to decompile {type.FullName}: {typeEx.Message}");
                        sb.AppendLine();
                    }
                }
                
                code = sb.ToString();
                
                if (string.IsNullOrWhiteSpace(code))
                {
                    code = "// No decompilable types found in this assembly";
                }
            }
            
            await SendJsonResponse(response, new { code });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Decompile error: {ex}");
            await SendJsonResponse(response, new { 
                code = $"// Decompilation error: {ex.Message}\n// Stack: {ex.StackTrace?.Split('\n').FirstOrDefault()}" 
            });
        }
    }
    
    private static async Task HandleSearch(HttpListenerRequest request, HttpListenerResponse response)
    {
        var assemblyId = request.QueryString["assembly"];
        var query = request.QueryString["q"];
        
        if (string.IsNullOrEmpty(assemblyId) || string.IsNullOrEmpty(query))
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "Missing assembly or query parameter" });
            return;
        }
        
        var assemblyPath = FindAssembly(assemblyId);
        if (assemblyPath == null)
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "Assembly not found" });
            return;
        }
        
        var results = new List<object>();
        
        try
        {
            var decompiler = CreateDecompiler(assemblyPath);
            var typeSystem = decompiler.TypeSystem;
            
            foreach (var type in typeSystem.MainModule.TopLevelTypeDefinitions)
            {
                if (type.Name.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    type.FullName.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    results.Add(new
                    {
                        name = type.Name,
                        fullName = type.FullName,
                        kind = "type"
                    });
                }
                
                foreach (var method in type.Members.OfType<IMethod>())
                {
                    if (method.Name.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        results.Add(new
                        {
                            name = method.Name,
                            fullName = $"{type.FullName}.{method.Name}",
                            kind = "method",
                            typeName = type.FullName
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Search error: {ex}");
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
            return;
        }
        
        await SendJsonResponse(response, new { results });
    }
    
    private static async Task HandleServeFile(string path, HttpListenerResponse response)
    {
        var fileName = path.Substring("/api/file/".Length);
        var filePath = Path.Combine(UploadDir, fileName);
        
        if (!File.Exists(filePath))
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "File not found" });
            return;
        }
        
        response.ContentType = "application/octet-stream";
        response.AddHeader("Content-Disposition", $"attachment; filename=\"{fileName}\"");
        
        var bytes = await File.ReadAllBytesAsync(filePath);
        await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
    }
    
    private static async Task HandleDeleteAssembly(string path, HttpListenerResponse response)
    {
        var assemblyId = path.Substring("/api/assembly/".Length);
        var assemblyPath = FindAssembly(assemblyId);
        
        if (assemblyPath == null)
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "Assembly not found" });
            return;
        }
        
        try
        {
            File.Delete(assemblyPath);
            await SendJsonResponse(response, new { success = true, message = $"Deleted {assemblyId}" });
        }
        catch (Exception ex)
        {
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
    }
    
    private static async Task HandleOpenInFileManager(string path, HttpListenerResponse response)
    {
        // Extract assembly ID from path like /api/assembly/{id}/open-folder
        var parts = path.Split('/');
        var assemblyId = parts[3]; // 0="", 1="api", 2="assembly", 3="{id}"
        var assemblyPath = FindAssembly(assemblyId);
        
        if (assemblyPath == null)
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "Assembly not found" });
            return;
        }
        
        try
        {
            var directory = Path.GetDirectoryName(assemblyPath) ?? assemblyPath;
            // Open file manager at the directory containing the assembly
            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "xdg-open",
                Arguments = directory,
                UseShellExecute = false
            };
            System.Diagnostics.Process.Start(startInfo);
            await SendJsonResponse(response, new { success = true });
        }
        catch (Exception ex)
        {
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
    }
    
    private static async Task HandleExportProject(string path, HttpListenerResponse response)
    {
        // Extract assembly ID from path like /api/assembly/{id}/export-project
        var parts = path.Split('/');
        var assemblyId = parts[3];
        var assemblyPath = FindAssembly(assemblyId);
        
        if (assemblyPath == null)
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "Assembly not found" });
            return;
        }
        
        try
        {
            var assemblyName = Path.GetFileNameWithoutExtension(assemblyPath);
            var exportDir = Path.Combine(UploadDir, "exported", assemblyName);
            
            // Clean up existing export directory
            if (Directory.Exists(exportDir))
            {
                Directory.Delete(exportDir, true);
            }
            Directory.CreateDirectory(exportDir);
            
            // Create a .csproj file
            var csprojContent = $@"<Project Sdk=""Microsoft.NET.Sdk"">
  <PropertyGroup>
    <OutputType>Library</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <AssemblyName>{assemblyName}</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>";
            
            var csprojPath = Path.Combine(exportDir, $"{assemblyName}.csproj");
            await File.WriteAllTextAsync(csprojPath, csprojContent);
            
            // Get all types and decompile each one separately
            var decompiler = CreateDecompiler(assemblyPath);
            var typeSystem = decompiler.TypeSystem;
            var mainModule = typeSystem.MainModule;
            
            // Group types by namespace
            var typesByNamespace = new Dictionary<string, List<(string fullName, string code)>>();
            
            foreach (var type in mainModule.TopLevelTypeDefinitions)
            {
                try
                {
                    // Skip compiler-generated types for events, etc.
                    if (type.Name.StartsWith("<") || type.FullName.StartsWith("<"))
                        continue;
                    
                    var code = decompiler.DecompileTypeAsString(new ICSharpCode.Decompiler.TypeSystem.FullTypeName(type.FullName));
                    var ns = type.Namespace ?? "";
                    
                    if (!typesByNamespace.ContainsKey(ns))
                    {
                        typesByNamespace[ns] = new List<(string, string)>();
                    }
                    typesByNamespace[ns].Add((type.FullName, code));
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to decompile type {type.FullName}: {ex.Message}");
                }
            }
            
            // Write files organized by namespace
            foreach (var kvp in typesByNamespace)
            {
                var ns = kvp.Key;
                var types = kvp.Value;
                
                // Create namespace directory
                string nsDir;
                if (string.IsNullOrEmpty(ns))
                {
                    nsDir = exportDir;
                }
                else
                {
                    nsDir = Path.Combine(exportDir, ns.Replace('.', Path.DirectorySeparatorChar));
                    Directory.CreateDirectory(nsDir);
                }
                
                // Write each type to its own file
                foreach (var (fullName, code) in types)
                {
                    // Get the simple type name (without namespace)
                    var simpleName = fullName;
                    if (!string.IsNullOrEmpty(ns) && fullName.StartsWith(ns + "."))
                    {
                        simpleName = fullName.Substring(ns.Length + 1);
                    }
                    
                    // Handle nested types (e.g., OuterClass+NestedClass)
                    var fileName = simpleName.Replace('+', '.') + ".cs";
                    var filePath = Path.Combine(nsDir, fileName);
                    
                    // Ensure unique filename if there are conflicts
                    var finalPath = filePath;
                    var counter = 1;
                    while (File.Exists(finalPath))
                    {
                        finalPath = Path.Combine(nsDir, $"{Path.GetFileNameWithoutExtension(fileName)}_{counter}.cs");
                        counter++;
                    }
                    
                    await File.WriteAllTextAsync(finalPath, code);
                }
            }
            
            await SendJsonResponse(response, new { success = true, path = exportDir });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Export error: {ex}");
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
    }
    
    private static async Task HandleListDirectory(HttpListenerRequest request, HttpListenerResponse response)
    {
        var dirPath = request.QueryString["path"] ?? "/";
        
        // Security: only allow absolute paths and prevent directory traversal
        if (!Path.IsPathRooted(dirPath))
        {
            dirPath = Path.GetFullPath(Path.Combine("/", dirPath));
        }
        
        if (!Directory.Exists(dirPath))
        {
            await SendJsonResponse(response, new { error = "Directory not found", path = dirPath });
            return;
        }
        
        try
        {
            var directories = new List<object>();
            var files = new List<object>();
            
            // Get parent directory
            var parentDir = Directory.GetParent(dirPath)?.FullName;
            
            // List directories
            foreach (var dir in Directory.GetDirectories(dirPath))
            {
                try
                {
                    var info = new DirectoryInfo(dir);
                    directories.Add(new
                    {
                        name = info.Name,
                        path = info.FullName,
                        isDirectory = true,
                        lastModified = info.LastWriteTimeUtc
                    });
                }
                catch
                {
                    // Skip inaccessible directories
                }
            }
            
            // List .dll and .exe files
            foreach (var file in Directory.GetFiles(dirPath))
            {
                var ext = Path.GetExtension(file).ToLowerInvariant();
                if (ext == ".dll" || ext == ".exe")
                {
                    try
                    {
                        var info = new FileInfo(file);
                        files.Add(new
                        {
                            name = info.Name,
                            path = info.FullName,
                            size = info.Length,
                            isDirectory = false,
                            extension = ext,
                            lastModified = info.LastWriteTimeUtc
                        });
                    }
                    catch
                    {
                        // Skip inaccessible files
                    }
                }
            }
            
            await SendJsonResponse(response, new
            {
                currentPath = dirPath,
                parentPath = parentDir,
                directories = directories.OrderBy(d => d.GetType().GetProperty("name")?.GetValue(d)).ToArray(),
                files = files.OrderBy(f => f.GetType().GetProperty("name")?.GetValue(f)).ToArray()
            });
        }
        catch (Exception ex)
        {
            await SendJsonResponse(response, new { error = ex.Message });
        }
    }
    
    private static async Task HandleOpenFile(HttpListenerRequest request, HttpListenerResponse response)
    {
        var filePath = request.QueryString["path"];
        
        if (string.IsNullOrEmpty(filePath))
        {
            // Try to read from body
            using var reader = new StreamReader(request.InputStream);
            var body = await reader.ReadToEndAsync();
            try
            {
                var json = System.Text.Json.JsonDocument.Parse(body);
                filePath = json.RootElement.GetProperty("path").GetString();
            }
            catch
            {
                response.StatusCode = 400;
                await SendJsonResponse(response, new { error = "Missing file path" });
                return;
            }
        }
        
        if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "File not found", path = filePath });
            return;
        }
        
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        if (ext != ".dll" && ext != ".exe")
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "Only .dll and .exe files are supported" });
            return;
        }
        
        try
        {
            // Create a copy in uploads directory
            var fileId = Guid.NewGuid().ToString("N");
            var fileName = Path.GetFileNameWithoutExtension(filePath);
            var destPath = Path.Combine(UploadDir, $"{fileId}{ext}");
            
            File.Copy(filePath, destPath, true);
            
            // Get assembly info
            using var stream = File.OpenRead(destPath);
            using var peReader = new PEReader(stream);
            var reader = peReader.GetMetadataReader();
            var assemblyDef = reader.GetAssemblyDefinition();
            var assemblyName = reader.GetString(assemblyDef.Name);
            
            await SendJsonResponse(response, new
            {
                success = true,
                assembly = new
                {
                    id = fileId,
                    name = assemblyName,
                    fileName = fileName + ext,
                    version = assemblyDef.Version.ToString(),
                    originalPath = filePath,
                    path = $"{fileId}{ext}"
                }
            });
        }
        catch (Exception ex)
        {
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
    }
    
    private static string? FindAssembly(string assemblyId)
    {
        // Try exact match
        var exactPath = Path.Combine(UploadDir, assemblyId);
        if (File.Exists(exactPath)) return exactPath;
        
        // Try with extensions
        foreach (var ext in new[] { ".dll", ".exe" })
        {
            var path = Path.Combine(UploadDir, $"{assemblyId}{ext}");
            if (File.Exists(path)) return path;
        }
        
        // Try by id prefix (GUID)
        foreach (var file in Directory.GetFiles(UploadDir))
        {
            if (Path.GetFileNameWithoutExtension(file) == assemblyId)
            {
                return file;
            }
        }
        
        return null;
    }
    
    private static string GetBoundary(string contentType)
    {
        var parts = contentType.Split(';');
        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            if (trimmed.StartsWith("boundary="))
            {
                return trimmed.Substring("boundary=".Length).Trim('"');
            }
        }
        return "";
    }
    
    private static async Task<Dictionary<string, byte[]>> ParseMultipartData(Stream stream, string boundary)
    {
        var files = new Dictionary<string, byte[]>();
        var boundaryBytes = Encoding.UTF8.GetBytes("--" + boundary);
        var endBoundaryBytes = Encoding.UTF8.GetBytes("--" + boundary + "--");
        
        using var memoryStream = new MemoryStream();
        await stream.CopyToAsync(memoryStream);
        var data = memoryStream.ToArray();
        
        var start = 0;
        
        while (start < data.Length)
        {
            // Find boundary
            var found = IndexOf(data, boundaryBytes, start);
            if (found == -1) break;
            
            start = found + boundaryBytes.Length + 2; // Skip boundary + \r\n
            
            // Find next boundary
            var nextBoundary = IndexOf(data, boundaryBytes, start);
            if (nextBoundary == -1)
            {
                nextBoundary = IndexOf(data, endBoundaryBytes, start);
                if (nextBoundary == -1) break;
            }
            
            // Get content between boundaries
            var contentLength = nextBoundary - start - 2; // -2 for \r\n before boundary
            if (contentLength <= 0) break;
            
            var content = new byte[contentLength];
            Array.Copy(data, start, content, 0, contentLength);
            
            // Parse headers
            var headerEnd = IndexOf(content, new byte[] { 13, 10, 13, 10 }, 0);
            if (headerEnd == -1) break;
            
            var headers = Encoding.UTF8.GetString(content, 0, headerEnd);
            var fileData = new byte[content.Length - headerEnd - 4];
            Array.Copy(content, headerEnd + 4, fileData, 0, fileData.Length);
            
            // Extract filename
            var filenameMatch = System.Text.RegularExpressions.Regex.Match(headers, @"filename=""(.+?)""");
            if (filenameMatch.Success)
            {
                var filename = filenameMatch.Groups[1].Value;
                files[filename] = fileData;
            }
            
            start = nextBoundary;
        }
        
        return files;
    }
    
    private static int IndexOf(byte[] data, byte[] pattern, int startIndex)
    {
        for (var i = startIndex; i <= data.Length - pattern.Length; i++)
        {
            var found = true;
            for (var j = 0; j < pattern.Length; j++)
            {
                if (data[i + j] != pattern[j])
                {
                    found = false;
                    break;
                }
            }
            if (found) return i;
        }
        return -1;
    }
    
    private static async Task SendJsonResponse(HttpListenerResponse response, object data)
    {
        response.ContentType = "application/json";
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        });
        var bytes = Encoding.UTF8.GetBytes(json);
        await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
    }
}