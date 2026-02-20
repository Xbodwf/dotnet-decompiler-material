using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.Json;
using System.Threading.Tasks;
using ICSharpCode.Decompiler;
using ICSharpCode.Decompiler.CSharp;
using ICSharpCode.Decompiler.Metadata;
using ICSharpCode.Decompiler.TypeSystem;

partial class DecompilerService
{
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
                code = decompiler.DecompileTypeAsString(new FullTypeName(typeName));
            }
            else
            {
                code = decompiler.DecompileWholeModuleAsString();
            }
            
            await SendJsonResponse(response, new { code });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Decompile error: {ex}");
            response.StatusCode = 500;
            await SendJsonResponse(response, new { error = ex.Message, stackTrace = ex.StackTrace });
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
                fullName = prop.FullName ?? prop.Name
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
                fullName = evt.FullName ?? evt.Name
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
    
    private static CSharpDecompiler CreateDecompiler(string assemblyPath)
    {
        var settings = new DecompilerSettings();
        
        // Create assembly resolver that looks for dependencies
        var assemblyDirectory = Path.GetDirectoryName(assemblyPath) ?? "";
        var targetFramework = "net10.0";
        
        var resolver = new UniversalAssemblyResolver(
            assemblyPath,
            false,
            targetFramework,
            null,
            PEStreamOptions.PrefetchEntireImage
        );
        
        // Add the assembly directory as a search path
        resolver.AddSearchDirectory(assemblyDirectory);
        
        // Add runtime directories
        var runtimeDir = Path.GetDirectoryName(typeof(object).Assembly.Location);
        if (runtimeDir != null)
        {
            resolver.AddSearchDirectory(runtimeDir);
        }
        
        return new CSharpDecompiler(assemblyPath, resolver, settings);
    }
}
