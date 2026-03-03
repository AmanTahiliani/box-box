package api

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
)

type FileCache struct {
	dir string
}

func NewFileCache() *FileCache {
	var cacheDir string
	userCacheDir, err := os.UserCacheDir()
	if err == nil {
		cacheDir = filepath.Join(userCacheDir, "box-box", "openf1")
	} else {
		// Fallback to a local .cache directory
		cacheDir = ".cache/box-box/openf1"
	}

	// Ensure the cache directory exists
	_ = os.MkdirAll(cacheDir, 0755)

	return &FileCache{
		dir: cacheDir,
	}
}

func (c *FileCache) getCachePath(key string) string {
	hash := sha256.Sum256([]byte(key))
	filename := hex.EncodeToString(hash[:]) + ".json"
	return filepath.Join(c.dir, filename)
}

// Get retrieves data from the cache. Returns nil, false if not found.
func (c *FileCache) Get(key string) ([]byte, bool) {
	path := c.getCachePath(key)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	return data, true
}

// Set saves data to the cache.
func (c *FileCache) Set(key string, data []byte) error {
	path := c.getCachePath(key)
	return os.WriteFile(path, data, 0644)
}
