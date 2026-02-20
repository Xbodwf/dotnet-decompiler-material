using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.Json;
using System.Threading.Tasks;

partial class DecompilerService
{
    private static async Task HandleListDirectory(HttpListenerRequest request, HttpListenerResponse response)
    {
        var dirPath = request.QueryString["path"] ?? "/";
        
        // Security: only allow absolute paths and prevent directory traversal
        if (!Path.IsPathRooted(dirPath))
        {
            dirPath = Path.GetFullPath(Path.Combine("/", dirPath));
        }
        
        // Handle home directory
        if (dirPath == "~" || dirPath == "$HOME")
        {
            dirPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        }
        
        try
        {
            var directories = new List<object>();
            var files = new List<object>();
            
            if (Directory.Exists(dirPath))
            {
                foreach (var dir in Directory.GetDirectories(dirPath))
                {
                    try
                    {
                        var info = new DirectoryInfo(dir);
                        directories.Add(new
                        {
                            name = info.Name,
                            path = info.FullName,
                            isDirectory = true
                        });
                    }
                    catch { }
                }
                
                foreach (var file in Directory.GetFiles(dirPath))
                {
                    try
                    {
                        var info = new FileInfo(file);
                        var ext = info.Extension.ToLower();
                        files.Add(new
                        {
                            name = info.Name,
                            path = info.FullName,
                            isDirectory = false,
                            extension = ext,
                            size = info.Length,
                            isAssembly = ext == ".dll" || ext == ".exe"
                        });
                    }
                    catch { }
                }
            }
            
            // Calculate parent path
            string? parentPath = null;
            try
            {
                var parent = Directory.GetParent(dirPath);
                if (parent != null)
                {
                    parentPath = parent.FullName;
                }
            }
            catch { }
            
            await SendJsonResponse(response, new { currentPath = dirPath, parentPath, directories, files });
        }
        catch (Exception ex)
        {
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
    }
    
    private static async Task HandleOpenFile(HttpListenerRequest request, HttpListenerResponse response)
    {
        using var reader = new StreamReader(request.InputStream);
        var body = await reader.ReadToEndAsync();
        var data = JsonSerializer.Deserialize<JsonElement>(body);
        
        var filePath = data.GetProperty("path").GetString();
        
        if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
        {
            response.StatusCode = 404;
            await SendJsonResponse(response, new { error = "File not found" });
            return;
        }
        
        var ext = Path.GetExtension(filePath).ToLower();
        if (ext != ".dll" && ext != ".exe")
        {
            response.StatusCode = 400;
            await SendJsonResponse(response, new { error = "Only .dll and .exe files are supported" });
            return;
        }
        
        try
        {
            // Copy file to uploads directory with original name
            var fileName = Path.GetFileName(filePath);
            var destPath = Path.Combine(UploadDir, fileName);
            var counter = 1;
            
            // If file exists with same name, check if it's the same file
            if (File.Exists(destPath))
            {
                var existingInfo = new FileInfo(destPath);
                var newInfo = new FileInfo(filePath);
                
                // If different file, add suffix
                if (existingInfo.Length != newInfo.Length)
                {
                    var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                    while (File.Exists(destPath))
                    {
                        destPath = Path.Combine(UploadDir, $"{nameWithoutExt}_{counter}{ext}");
                        counter++;
                    }
                    File.Copy(filePath, destPath, false);
                }
                // Same file, just use existing
            }
            else
            {
                File.Copy(filePath, destPath, false);
            }
            
            var id = Path.GetFileNameWithoutExtension(destPath);
            string version = "Unknown";
            
            try
            {
                using var stream = File.OpenRead(destPath);
                using var peReader = new System.Reflection.PortableExecutable.PEReader(stream);
                var metadataReader = peReader.GetMetadataReader();
                var assemblyDef = metadataReader.GetAssemblyDefinition();
                version = $"{assemblyDef.Version.Major}.{assemblyDef.Version.Minor}.{assemblyDef.Version.Build}.{assemblyDef.Version.Revision}";
            }
            catch { }
            
            await SendJsonResponse(response, new
            {
                assembly = new
                {
                    id,
                    name = Path.GetFileName(destPath),
                    fileName = Path.GetFileName(destPath),
                    version
                }
            });
        }
        catch (Exception ex)
        {
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message });
        }
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
}
