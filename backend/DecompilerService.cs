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

partial class DecompilerService
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
        
        // On Android/Termux, we need to listen on localhost only due to permission restrictions
        // The Vite dev server will proxy API requests from mobile devices
        listener.Prefixes.Add($"http://localhost:{Port}/");
        listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
        
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
    
    // Helper methods
    private static async Task SendJsonResponse(HttpListenerResponse response, object data)
    {
        response.ContentType = "application/json";
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions 
        { 
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });
        var bytes = Encoding.UTF8.GetBytes(json);
        await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
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
}
