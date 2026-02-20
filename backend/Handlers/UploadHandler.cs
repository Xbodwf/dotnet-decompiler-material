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

partial class DecompilerService
{
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
            // Use original filename, add suffix if conflicts
            var fileName = file.FileName;
            var destPath = Path.Combine(UploadDir, fileName);
            var counter = 1;
            
            while (File.Exists(destPath))
            {
                var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                var ext = Path.GetExtension(fileName);
                destPath = Path.Combine(UploadDir, $"{nameWithoutExt}_{counter}{ext}");
                counter++;
            }
            
            await File.WriteAllBytesAsync(destPath, file.Data);
            
            var id = Path.GetFileNameWithoutExtension(destPath);
            
            uploadedFiles.Add(new
            {
                id,
                name = Path.GetFileName(destPath),
                size = file.Data.Length,
                path = destPath
            });
        }
        
        await SendJsonResponse(response, new { files = uploadedFiles });
    }
    
    private static async Task HandleListAssemblies(HttpListenerResponse response)
    {
        var assemblies = new List<object>();
        
        if (Directory.Exists(UploadDir))
        {
            foreach (var file in Directory.GetFiles(UploadDir))
            {
                var ext = Path.GetExtension(file).ToLower();
                if (ext != ".dll" && ext != ".exe") continue;
                
                var name = Path.GetFileName(file);
                var id = Path.GetFileNameWithoutExtension(file);
                
                // Try to read assembly version
                string version = "Unknown";
                try
                {
                    using var stream = File.OpenRead(file);
                    using var peReader = new System.Reflection.PortableExecutable.PEReader(stream);
                    var metadataReader = peReader.GetMetadataReader();
                    var assemblyDef = metadataReader.GetAssemblyDefinition();
                    version = $"{assemblyDef.Version.Major}.{assemblyDef.Version.Minor}.{assemblyDef.Version.Build}.{assemblyDef.Version.Revision}";
                }
                catch { }
                
                assemblies.Add(new { id, name, fileName = name, version });
            }
        }
        
        await SendJsonResponse(response, new { assemblies });
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
    
    private static string GetBoundary(string contentType)
    {
        var elements = contentType.Split(';');
        foreach (var element in elements)
        {
            var trimmed = element.Trim();
            if (trimmed.StartsWith("boundary="))
            {
                return trimmed.Substring(9).Trim('"');
            }
        }
        return "";
    }
    
    private static async Task<List<UploadedFile>> ParseMultipartData(Stream stream, string boundary)
    {
        var files = new List<UploadedFile>();
        var boundaryBytes = Encoding.UTF8.GetBytes("--" + boundary);
        var endBoundaryBytes = Encoding.UTF8.GetBytes("--" + boundary + "--");
        
        using var memoryStream = new MemoryStream();
        await stream.CopyToAsync(memoryStream);
        var data = memoryStream.ToArray();
        
        var positions = new List<int>();
        var pos = 0;
        while ((pos = IndexOf(data, boundaryBytes, pos)) != -1)
        {
            positions.Add(pos);
            pos += boundaryBytes.Length;
        }
        
        for (int i = 0; i < positions.Count - 1; i++)
        {
            var start = positions[i] + boundaryBytes.Length + 2; // +2 for \r\n
            var end = positions[i + 1];
            
            var content = new byte[end - start];
            Array.Copy(data, start, content, 0, content.Length);
            
            // Find header/content separator
            var separatorIndex = IndexOf(content, Encoding.UTF8.GetBytes("\r\n\r\n"));
            if (separatorIndex == -1) continue;
            
            var headerBytes = new byte[separatorIndex];
            Array.Copy(content, 0, headerBytes, 0, separatorIndex);
            var header = Encoding.UTF8.GetString(headerBytes);
            
            var contentStart = separatorIndex + 4;
            var contentEnd = content.Length - 2; // -2 for trailing \r\n
            var contentData = new byte[contentEnd - contentStart];
            Array.Copy(content, contentStart, contentData, 0, contentData.Length);
            
            // Parse filename from header
            var fileName = "";
            var filenameIndex = header.IndexOf("filename=\"");
            if (filenameIndex != -1)
            {
                filenameIndex += 10;
                var endIndex = header.IndexOf("\"", filenameIndex);
                if (endIndex != -1)
                {
                    fileName = header.Substring(filenameIndex, endIndex - filenameIndex);
                }
            }
            
            if (!string.IsNullOrEmpty(fileName))
            {
                files.Add(new UploadedFile { FileName = fileName, Data = contentData });
            }
        }
        
        return files;
    }
    
    private static int IndexOf(byte[] source, byte[] pattern, int startIndex = 0)
    {
        for (int i = startIndex; i <= source.Length - pattern.Length; i++)
        {
            bool found = true;
            for (int j = 0; j < pattern.Length; j++)
            {
                if (source[i + j] != pattern[j])
                {
                    found = false;
                    break;
                }
            }
            if (found) return i;
        }
        return -1;
    }
    
    private class UploadedFile
    {
        public string FileName { get; set; } = "";
        public byte[] Data { get; set; } = Array.Empty<byte>();
    }
}
