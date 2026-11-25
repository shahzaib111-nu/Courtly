package com.scd.courtly.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;
import java.util.HashMap;

@RestController
public class HelloController {

    @GetMapping("/api/test")
    public Map<String, String> testConnection() {
        HashMap<String, String> map = new HashMap<>();
        map.put("message", "Success! Backend is connected.");
        return map;
    }
}