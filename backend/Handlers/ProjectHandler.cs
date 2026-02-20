using System;
using System.IO;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using ICSharpCode.Decompiler;
using ICSharpCode.Decompiler.CSharp;
using ICSharpCode.Decompiler.TypeSystem;

partial class DecompilerService
{
    private static async Task HandleOpenInFileManager(string path, HttpListenerResponse response)
    {
        // Extract assembly ID from path like /api/assembly/{id}/open-folder
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
            var directory = Path.GetDirectoryName(assemblyPath) ?? assemblyPath;
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
            var typesByNamespace = new System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<(string fullName, string code)>>();
            
            foreach (var type in mainModule.TopLevelTypeDefinitions)
            {
                try
                {
                    // Skip compiler-generated types
                    if (type.Name.StartsWith("<") || type.FullName.StartsWith("<"))
                        continue;
                    
                    var code = decompiler.DecompileTypeAsString(new FullTypeName(type.FullName));
                    var ns = type.Namespace ?? "";
                    
                    if (!typesByNamespace.ContainsKey(ns))
                    {
                        typesByNamespace[ns] = new System.Collections.Generic.List<(string, string)>();
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
                    var simpleName = fullName;
                    if (!string.IsNullOrEmpty(ns) && fullName.StartsWith(ns + "."))
                    {
                        simpleName = fullName.Substring(ns.Length + 1);
                    }
                    
                    var fileName = simpleName.Replace('+', '.') + ".cs";
                    var filePath = Path.Combine(nsDir, fileName);
                    
                    // Ensure unique filename
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
}
